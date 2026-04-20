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
        }}
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
