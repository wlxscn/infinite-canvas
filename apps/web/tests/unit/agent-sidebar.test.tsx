import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentSidebar } from '../../src/features/chat/components/AgentSidebar';
import type { ChatSession } from '../../src/types/canvas';

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
      { id: 'a1', role: 'assistant', text: '我会先生成一张温暖写实风格的狗图像。', createdAt: 2, suggestions: [] },
    ],
    ...overrides,
  };
}

describe('AgentSidebar', () => {
  it('renders current task summary, timeline, next actions, and history entries', () => {
    const onSuggestion = vi.fn();
    const onActivateSession = vi.fn();

    render(
      <AgentSidebar
        isOpen
        sessionCount={2}
        sessions={[
          createSession(),
          createSession({
            id: 'session_old',
            title: '旧方向',
            updatedAt: 1,
            messages: [{ id: 'u2', role: 'user', text: '旧方向', createdAt: 1, suggestions: [] }],
          }),
        ]}
        sessionHistory={[{ id: 'session_old', title: '旧方向', subtitle: '旧方向', isActive: false }]}
        activeSessionId="session_active"
        activeSession={createSession()}
        currentTask={{
          title: '生成一只狗',
          summary: '正在根据当前方向执行生成：生成一只狗',
          intent: 'generate-image',
          intentLabel: '图片生成',
          status: 'generating',
          statusLabel: '生成图片中',
          latestUserMessage: createSession().messages[0],
          latestAssistantMessage: createSession().messages[1],
          latestEffectType: 'start-generation',
          latestJobId: 'job_1',
          nextActions: [{ id: 's1', label: '继续生成变体', action: 'generate-variants' }],
          timeline: [
            { id: 'received', label: '已接收任务', status: 'done' },
            { id: 'planned', label: '已生成执行说明', status: 'done' },
            { id: 'action', label: '正在执行图片生成', status: 'current' },
            { id: 'result', label: '等待结果落地', status: 'pending' },
          ],
        }}
        chatInput=""
        composerStatusText="可继续输入"
        voiceButtonLabel="录音"
        voiceComposer={{ status: 'idle', errorMessage: null, toggleRecording: vi.fn().mockResolvedValue(undefined) }}
        chatThreadRef={{ current: null }}
        onCreateSession={vi.fn()}
        onActivateSession={onActivateSession}
        onClose={vi.fn()}
        onChatInputChange={vi.fn()}
        onSubmitChat={vi.fn()}
        onSuggestion={onSuggestion}
      />,
    );

    expect(screen.getByRole('heading', { name: '生成一只狗' })).toBeTruthy();
    expect(screen.getByLabelText('执行过程')).toBeTruthy();
    expect(screen.getByLabelText('下一步')).toBeTruthy();
    expect(screen.getByLabelText('历史任务')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '继续生成变体' }));
    expect(onSuggestion).toHaveBeenCalledWith('generate-variants');

    fireEvent.click(screen.getByRole('button', { name: '旧方向 旧方向' }));
    expect(onActivateSession).toHaveBeenCalledWith('session_old');
  });

  it('shows an empty-task state and task-oriented placeholder when no active session exists', () => {
    render(
      <AgentSidebar
        isOpen
        sessionCount={0}
        sessions={[]}
        sessionHistory={[]}
        activeSessionId={null}
        activeSession={null}
        currentTask={null}
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

    expect(screen.getByText('暂无任务')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '新任务' })).toHaveLength(2);
    expect(screen.getByPlaceholderText('描述你想启动的任务，系统会自动创建任务线程')).toBeTruthy();
  });
});
