import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentSidebar } from '../../src/features/chat/components/AgentSidebar';
import type { ChatSession } from '../../src/types/canvas';

vi.mock('../../src/features/chat/hooks/useTypewriterText', () => ({
  useTypewriterText: (message: { text: string } | null) => message?.text ?? '',
}));

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session_active',
    title: '生成一只狗',
    createdAt: 1,
    updatedAt: 2,
    conversationId: 'conv_1',
    previousResponseId: null,
    messages: [
      { id: 'u1', role: 'user', text: '生成一只狗', createdAt: 1, suggestions: [] },
      {
        id: 'a1',
        role: 'assistant',
        text: '这是总结。\n\n| 列A | 列B |\n| --- | --- |\n| 方案一 | 更稳 |\n',
        createdAt: 2,
        suggestions: [{ id: 's1', label: '继续生成变体', action: 'generate-variants' }],
        effects: [],
      },
    ],
    ...overrides,
  };
}

describe('AgentSidebar', () => {
  it('renders final assistant messages as markdown with a GFM table and suggestion chips', () => {
    const onSuggestion = vi.fn();

    render(
      <AgentSidebar
        isOpen
        sessionCount={2}
        sessions={[createSession()]}
        sessionHistory={[{ id: 'session_old', title: '旧方向', subtitle: '旧方向', isActive: false }]}
        activeSessionId="session_active"
        activeSession={createSession()}
        currentTask={null}
        streamingAssistantMessage={null}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={onSuggestion}
      />,
    );

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('方案一')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '继续生成变体' }));
    expect(onSuggestion).toHaveBeenCalledWith('generate-variants');
  });

  it('renders duplicate assistant suggestions once', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={1}
        sessions={[
          createSession({
            messages: [
              { id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [] },
              {
                id: 'a1',
                role: 'assistant',
                text: '可以继续优化。',
                createdAt: 2,
                suggestions: [
                  { id: 'suggest-variants', label: '生成系列海报', action: 'generate-variants' },
                  { id: 'suggest-variants', label: '生成系列海报', action: 'generate-variants' },
                  { id: 'suggest-add-text', label: '添加宣传文字', action: 'add-text' },
                ],
                effects: [],
              },
            ],
          }),
        ]}
        sessionHistory={[]}
        activeSessionId="session_active"
        activeSession={createSession({
          messages: [
            { id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [] },
            {
              id: 'a1',
              role: 'assistant',
              text: '可以继续优化。',
              createdAt: 2,
              suggestions: [
                { id: 'suggest-variants', label: '生成系列海报', action: 'generate-variants' },
                { id: 'suggest-variants', label: '生成系列海报', action: 'generate-variants' },
                { id: 'suggest-add-text', label: '添加宣传文字', action: 'add-text' },
              ],
              effects: [],
            },
          ],
        })}
        currentTask={null}
        streamingAssistantMessage={null}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: '生成系列海报' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '添加宣传文字' })).toBeTruthy();
  });

  it('shows streaming assistant text as plain text instead of parsing markdown early', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={1}
        sessions={[createSession({ messages: [{ id: 'u1', role: 'user', text: '给我一个对照表', createdAt: 1, suggestions: [] }] })]}
        sessionHistory={[]}
        activeSessionId="session_active"
        activeSession={createSession({ messages: [{ id: 'u1', role: 'user', text: '给我一个对照表', createdAt: 1, suggestions: [] }] })}
        currentTask={{
          title: '给我一个对照表',
          summary: '正在生成说明和对照表。',
          intent: 'chat',
          intentLabel: '对话问答',
          status: 'responding',
          statusLabel: '生成说明中',
          latestUserMessage: { id: 'u1', role: 'user', text: '给我一个对照表', createdAt: 1, suggestions: [] },
          latestAssistantMessage: null,
          latestEffectType: null,
          latestJobId: null,
          timeline: [],
          nextActions: [],
        }}
        streamingAssistantMessage={{
          id: 'a_stream',
          role: 'assistant',
          text: '| 列A | 列B |\n| --- | --- |\n| 方案一 | 更稳 |\n',
          createdAt: 2,
          suggestions: [],
          effects: [],
        }}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText((content) => content.includes('| 列A | 列B |'))).toBeTruthy();
  });

  it('renders generated image effects inside assistant messages', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={1}
        sessions={[
          createSession({
            messages: [
              { id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [], effects: [] },
              {
                id: 'a1',
                role: 'assistant',
                text: '海报已生成。',
                createdAt: 2,
                suggestions: [],
                effects: [
                  {
                    type: 'insert-image',
                    prompt: '艺术海报',
                    imageUrl: 'https://media.example.com/generated/poster.png',
                    width: 1024,
                    height: 1024,
                  },
                ],
              },
            ],
          }),
        ]}
        sessionHistory={[]}
        activeSessionId="session_active"
        activeSession={createSession({
          messages: [
            { id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [], effects: [] },
            {
              id: 'a1',
              role: 'assistant',
              text: '海报已生成。',
              createdAt: 2,
              suggestions: [],
              effects: [
                {
                  type: 'insert-image',
                  prompt: '艺术海报',
                  imageUrl: 'https://media.example.com/generated/poster.png',
                  width: 1024,
                  height: 1024,
                },
              ],
            },
          ],
        })}
        currentTask={null}
        streamingAssistantMessage={null}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: '艺术海报' });
    expect(image.getAttribute('src')).toBe('https://media.example.com/generated/poster.png');
  });

  it('shows a media placeholder inside the streaming assistant message while image generation is in progress', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={1}
        sessions={[createSession({ messages: [{ id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [], effects: [] }] })]}
        sessionHistory={[]}
        activeSessionId="session_active"
        activeSession={createSession({ messages: [{ id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [], effects: [] }] })}
        currentTask={{
          title: '生成一张海报',
          summary: '正在根据当前方向执行生成：艺术海报',
          intent: 'generate-image',
          intentLabel: '图片生成',
          status: 'generating',
          statusLabel: '生成图片中',
          latestUserMessage: { id: 'u1', role: 'user', text: '生成一张海报', createdAt: 1, suggestions: [], effects: [] },
          latestAssistantMessage: null,
          latestEffectType: 'start-generation',
          latestJobId: 'job_1',
          timeline: [],
          nextActions: [],
        }}
        streamingAssistantMessage={{
          id: 'a_stream',
          role: 'assistant',
          text: '正在为你生成海报。',
          createdAt: 2,
          suggestions: [],
          effects: [{ type: 'start-generation', prompt: '艺术海报', mediaType: 'image' }],
        }}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText('生成中')).toBeTruthy();
    expect(screen.getByText('正在为你生成海报。')).toBeTruthy();
  });

  it('shows a media placeholder in the pending assistant card when only SSE effects are available', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={1}
        sessions={[createSession({ messages: [{ id: 'u1', role: 'user', text: '生成一只小鸟', createdAt: 1, suggestions: [], effects: [] }] })]}
        sessionHistory={[]}
        activeSessionId="session_active"
        activeSession={createSession({ messages: [{ id: 'u1', role: 'user', text: '生成一只小鸟', createdAt: 1, suggestions: [], effects: [] }] })}
        currentTask={{
          title: '生成一只小鸟',
          summary: '已为您生成一只色彩鲜艳、细节清晰的小鸟素材。',
          intent: 'generate-image',
          intentLabel: '图片生成',
          status: 'generating',
          statusLabel: '生成图片中',
          latestUserMessage: { id: 'u1', role: 'user', text: '生成一只小鸟', createdAt: 1, suggestions: [], effects: [] },
          latestAssistantMessage: null,
          latestEffectType: 'start-generation',
          latestJobId: null,
          timeline: [],
          nextActions: [],
        }}
        streamingAssistantMessage={null}
        streamingEffects={[{ type: 'start-generation', prompt: '一只小鸟', mediaType: 'image' }]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText('生成中')).toBeTruthy();
    expect(screen.getByText('已为您生成一只色彩鲜艳、细节清晰的小鸟素材。')).toBeTruthy();
  });

  it('shows the current empty-state copy and session popover entry point when no active session exists', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={0}
        sessions={[]}
        sessionHistory={[]}
        activeSessionId={null}
        activeSession={null}
        currentTask={null}
        streamingAssistantMessage={null}
        streamingEffects={[]}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={vi.fn()}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={vi.fn()}
      />,
    );

    expect(screen.getByText('开始新的设计对话')).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 个会话' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '新对话' })).toHaveLength(2);
    expect(screen.getByPlaceholderText('给设计助理发送消息')).toBeTruthy();
  });
});
