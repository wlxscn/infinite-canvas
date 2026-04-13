import { useMemo, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { AgentChatRequest } from '@infinite-canvas/shared/api';
import type { ChatMessage } from '@infinite-canvas/shared/chat';
import { getAgentChatApiUrl } from '../api/chat-client';
import { extractAgentResponseData, toLocalChatMessage, toUIMessage } from '../mappers/chat-mapper';
import type { AgentUIMessage } from '../mappers/chat-mapper';

function logChat(event: string, payload: Record<string, unknown> = {}) {
  console.log(`[web/useAgentChat] ${event}`, payload);
}

interface UseAgentChatOptions {
  initialMessages: ChatMessage[];
  onAssistantFinish: (options: {
    message: ChatMessage;
    responseData: ReturnType<typeof extractAgentResponseData>;
    targetSessionId: string | null;
  }) => void;
  onError?: (error: Error) => void;
}

export function useAgentChat({ initialMessages, onAssistantFinish, onError }: UseAgentChatOptions) {
  const pendingTargetSessionIdRef = useRef<string | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: getAgentChatApiUrl(),
      }),
    [],
  );

  const chat = useChat<AgentUIMessage>({
    messages: initialMessages.map(toUIMessage),
    transport,
    onError(error) {
      logChat('transport:error', { message: error.message });
      onError?.(error);
    },
    onFinish({ message }) {
      const responseData = extractAgentResponseData(message);
      const localMessage = toLocalChatMessage(message);

      logChat('transport:finish', {
        messageId: message.id,
        role: message.role,
        textLength: localMessage.text.length,
        suggestionCount: responseData?.suggestions.length ?? 0,
        effectCount: responseData?.effects.length ?? 0,
        conversationId: responseData?.conversationId,
        previousResponseId: responseData?.previousResponseId,
      });

      onAssistantFinish({
        message: localMessage,
        responseData,
        targetSessionId: pendingTargetSessionIdRef.current,
      });
      pendingTargetSessionIdRef.current = null;
    },
  });

  async function sendAgentMessage(message: string, request: AgentChatRequest, targetSessionId: string | null) {
    pendingTargetSessionIdRef.current = targetSessionId;
    logChat('transport:send', {
      api: getAgentChatApiUrl(),
      message,
      conversationId: request.conversationId,
      previousResponseId: request.previousResponseId,
      historyCount: request.history?.length ?? 0,
    });

    await chat.sendMessage(
      { text: message },
      {
        body: request,
      },
    );

    logChat('transport:send:resolved', {
      message,
    });
  }

  return {
    sendAgentMessage,
    status: chat.status,
    error: chat.error,
  };
}
