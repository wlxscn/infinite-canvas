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

  it('merges multiple agent response data parts from a single SSE message', () => {
    const message = {
      id: 'assistant_2',
      role: 'assistant',
      parts: [
        { type: 'text', text: '我先返回文本，图片随后补发。' },
        {
          type: 'data-agentResponse',
          data: {
            suggestions: [{ id: 's1', label: '更换风格', action: 'change-style' as const }],
            effects: [],
            conversationId: 'conv_stream',
            previousResponseId: 'resp_stream',
          },
        },
        {
          type: 'data-agentResponse',
          data: {
            suggestions: [],
            effects: [
              {
                type: 'insert-image' as const,
                prompt: 'poster',
                imageUrl: 'https://example.com/image.jpg',
                width: 1280,
                height: 720,
              },
              {
                type: 'insert-video' as const,
                prompt: 'hero motion',
                videoUrl: 'https://example.com/video.mp4',
                width: 1920,
                height: 1080,
                durationSeconds: 8,
              },
            ],
            conversationId: 'conv_stream',
            previousResponseId: 'resp_stream',
          },
        },
      ],
    };

    const responseData = extractAgentResponseData(message);

    expect(responseData?.suggestions).toHaveLength(1);
    expect(responseData?.effects).toEqual([
      {
        type: 'insert-image',
        prompt: 'poster',
        imageUrl: 'https://example.com/image.jpg',
        width: 1280,
        height: 720,
      },
      {
        type: 'insert-video',
        prompt: 'hero motion',
        videoUrl: 'https://example.com/video.mp4',
        width: 1920,
        height: 1080,
        durationSeconds: 8,
      },
    ]);
  });
});
