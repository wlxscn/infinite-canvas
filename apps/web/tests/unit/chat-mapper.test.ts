import { describe, expect, it } from 'vitest';
import { extractAgentResponseData, toLocalChatMessage } from '../../src/features/chat/mappers/chat-mapper';

describe('chat mapper', () => {
  it('extracts assistant text and structured response data from an AI SDK message', () => {
    const message = {
      id: 'assistant_1',
      role: 'assistant',
      parts: [
        { type: 'text', text: '这是服务端返回的回答。' },
        {
          type: 'data-agentResponse',
          data: {
            suggestions: [{ id: 's1', label: '添加宣传文字', action: 'add-text' as const }],
            effects: [{ type: 'insert-text' as const, text: '新的标题' }],
            conversationId: 'conv_123',
            previousResponseId: 'resp_456',
          },
        },
      ],
    };

    const mapped = toLocalChatMessage(message);
    const responseData = extractAgentResponseData(message);

    expect(mapped.text).toBe('这是服务端返回的回答。');
    expect(mapped.suggestions).toHaveLength(1);
    expect(responseData?.conversationId).toBe('conv_123');
    expect(responseData?.effects).toEqual([{ type: 'insert-text', text: '新的标题' }]);
  });
});
