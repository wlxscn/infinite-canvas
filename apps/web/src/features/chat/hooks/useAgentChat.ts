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
  onResponseData?: (options: {
    responseData: ReturnType<typeof extractAgentResponseData>;
    targetSessionId: string | null;
  }) => void;
  onAssistantFinish: (options: {
    message: ChatMessage;
    responseData: ReturnType<typeof extractAgentResponseData>;
    targetSessionId: string | null;
  }) => void;
  onError?: (options: { error: Error; targetSessionId: string | null }) => void;
}

export function useAgentChat({ initialMessages, onResponseData, onAssistantFinish, onError }: UseAgentChatOptions) {
  const pendingTargetSessionIdRef = useRef<string | null>(null);
  const latestResponseDataRef = useRef<ReturnType<typeof extractAgentResponseData> | null>(null);
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
    onData(dataPart) {
      if (dataPart.type !== 'data-agentResponse') {
        return;
      }

      latestResponseDataRef.current = dataPart.data;
      logChat('transport:data-agentResponse', {
        suggestionCount: dataPart.data?.suggestions.length ?? 0,
        effectCount: dataPart.data?.effects.length ?? 0,
        conversationId: dataPart.data?.conversationId,
        previousResponseId: dataPart.data?.previousResponseId,
      });

      onResponseData?.({
        responseData: dataPart.data,
        targetSessionId: pendingTargetSessionIdRef.current,
      });
    },
    onError(error) {
      logChat('transport:error', { message: error.message });
      onError?.({
        error,
        targetSessionId: pendingTargetSessionIdRef.current,
      });
    },
    onFinish({ message }) {
      const responseData = extractAgentResponseData(message) ?? latestResponseDataRef.current;
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
      latestResponseDataRef.current = null;
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
