import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentChatRequest } from '@infinite-canvas/shared/api';
import { useAgentChat } from '../../src/features/chat/hooks/useAgentChat';

type AgentResponseData = {
  suggestions: Array<{ id: string; label: string; action: string }>;
  effects: Array<Record<string, unknown>>;
  conversationId?: string;
  previousResponseId?: string | null;
};

type RequestBehavior =
  | {
      kind: 'success';
      responseData?: AgentResponseData;
      holdOpen?: boolean;
    }
  | {
      kind: 'failure';
    };

const queuedBehaviors: RequestBehavior[] = [];
const openRequestResolvers: Array<() => void> = [];

function queueBehaviors(...behaviors: RequestBehavior[]) {
  queuedBehaviors.splice(0, queuedBehaviors.length, ...behaviors);
}

function resolveOpenRequests() {
  openRequestResolvers.splice(0).forEach((resolve) => resolve());
}

vi.mock('@ai-sdk/react', async () => {
  const React = await import('react');

  return {
    useChat: (options: {
      messages: Array<{ id: string; role: 'user' | 'assistant'; parts: Array<{ type: 'text'; text: string }> }>;
      onData?: (dataPart: { type: 'data-agentResponse'; data: AgentResponseData }) => void;
      onError?: (error: Error) => void;
      onFinish?: (payload: { message: { id: string; role: 'assistant'; parts: Array<{ type: 'text'; text: string }> } }) => void;
    }) => {
      const [messages, setMessages] = React.useState(options.messages);
      const [status, setStatus] = React.useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
      const [error, setError] = React.useState<Error | null>(null);

      async function sendMessage(message: { text: string }) {
        const behavior = queuedBehaviors.shift() ?? { kind: 'success' as const };
        const assistantMessage = {
          id: `assistant_${messages.length + 1}`,
          role: 'assistant' as const,
          parts: [{ type: 'text', text: '这是当前流式回复。' }],
        };
        const userMessage = {
          id: `user_${messages.length + 1}`,
          role: 'user' as const,
          parts: [{ type: 'text', text: message.text }],
        };

        setError(null);
        setStatus('submitted');
        setMessages((current) => [...current, userMessage, assistantMessage]);
        setStatus('streaming');

        if (behavior.kind === 'failure') {
          const requestError = new Error('failed to fetch');
          setError(requestError);
          setStatus('error');
          options.onError?.(requestError);
          return;
        }

        if (behavior.responseData) {
          options.onData?.({
            type: 'data-agentResponse',
            data: behavior.responseData,
          });
        }

        if (behavior.holdOpen) {
          await new Promise<void>((resolve) => {
            openRequestResolvers.push(resolve);
          });
        }

        if (!behavior.holdOpen) {
          options.onFinish?.({ message: assistantMessage });
          setStatus('ready');
        }
      }

      return {
        messages,
        status,
        error,
        sendMessage,
      };
    },
  };
});

describe('useAgentChat', () => {
  beforeEach(() => {
    queuedBehaviors.splice(0, queuedBehaviors.length);
    resolveOpenRequests();
  });

  it('does not keep showing the previous assistant text after a failed request', async () => {
    queueBehaviors({ kind: 'success' }, { kind: 'failure' });

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat({
        initialMessages: [],
        onAssistantFinish: vi.fn(),
        onError,
      }),
    );

    await act(async () => {
      await result.current.sendAgentMessage(
        '第一轮请求',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '第一轮请求',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    expect(result.current.streamingAssistantMessage).toBeNull();

    await act(async () => {
      await result.current.sendAgentMessage(
        '第二轮请求',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '第二轮请求',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.streamingAssistantMessage).toBeNull();
    expect(onError).toHaveBeenCalledWith({
      error: expect.any(Error),
      targetSessionId: 'session_1',
    });
  });

  it('clears the cached response data when a request fails', async () => {
    queueBehaviors(
      {
        kind: 'success',
        responseData: {
          suggestions: [],
          effects: [],
          conversationId: 'conv_old',
          previousResponseId: 'resp_old',
        },
      },
      { kind: 'failure' },
      { kind: 'success' },
    );

    const onAssistantFinish = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat({
        initialMessages: [],
        onAssistantFinish,
      }),
    );

    await act(async () => {
      await result.current.sendAgentMessage(
        '第一轮请求',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '第一轮请求',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    expect(onAssistantFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionId: 'session_1',
        responseData: expect.objectContaining({
          conversationId: 'conv_old',
          previousResponseId: 'resp_old',
        }),
      }),
    );

    await act(async () => {
      await result.current.sendAgentMessage(
        '第二轮请求',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '第二轮请求',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    await act(async () => {
      await result.current.sendAgentMessage(
        '第三轮请求',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '第三轮请求',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    expect(onAssistantFinish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetSessionId: 'session_1',
        responseData: null,
      }),
    );
  });

  it('merges streamed response data into the in-flight assistant message', async () => {
    queueBehaviors({
      kind: 'success',
      holdOpen: true,
      responseData: {
        suggestions: [],
        effects: [{ type: 'start-generation', prompt: '一只可爱的乌龟', mediaType: 'image' }],
        conversationId: 'conv_1',
        previousResponseId: 'resp_1',
      },
    });

    const { result } = renderHook(() =>
      useAgentChat({
        initialMessages: [],
        onAssistantFinish: vi.fn(),
      }),
    );

    let sendPromise: Promise<void> | null = null;
    act(() => {
      sendPromise = result.current.sendAgentMessage(
        '生成一只乌龟',
        {
          projectId: 'local-project',
          conversationId: 'conv_1',
          message: '生成一只乌龟',
          history: [],
          canvasContext: {} as AgentChatRequest['canvasContext'],
        },
        'session_1',
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('streaming');
    });

    expect(result.current.streamingAssistantMessage?.effects).toEqual([
      { type: 'start-generation', prompt: '一只可爱的乌龟', mediaType: 'image' },
    ]);

    resolveOpenRequests();
    await act(async () => {
      await sendPromise;
    });
  });
});
