import type { RefObject } from 'react';
import type { ChatSuggestionAction } from '@infinite-canvas/shared/chat';
import type { ChatSession } from '../../../types/canvas';
import type { DerivedCurrentTask, DerivedSessionHistoryEntry } from '../deriveCurrentTask';
import type { VoiceComposerStatus } from '../hooks/useVoiceComposer';

interface VoiceComposerViewModel {
  status: VoiceComposerStatus;
  errorMessage: string | null;
  toggleRecording: () => Promise<void>;
}

interface AgentSidebarProps {
  isOpen: boolean;
  sessionCount: number;
  sessions: ChatSession[];
  sessionHistory: DerivedSessionHistoryEntry[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  currentTask: DerivedCurrentTask | null;
  chatInput: string;
  composerStatusText: string;
  voiceButtonLabel: string;
  voiceComposer: VoiceComposerViewModel;
  chatThreadRef: RefObject<HTMLDivElement | null>;
  onCreateSession: () => void;
  onActivateSession: (sessionId: string) => void;
  onClose: () => void;
  onChatInputChange: (value: string) => void;
  onSubmitChat: () => void;
  onSuggestion: (action: ChatSuggestionAction) => void;
}

export function AgentSidebar({
  isOpen,
  sessionCount,
  sessions,
  sessionHistory,
  activeSessionId,
  activeSession,
  currentTask,
  chatInput,
  composerStatusText,
  voiceButtonLabel,
  voiceComposer,
  chatThreadRef,
  onCreateSession,
  onActivateSession,
  onClose,
  onChatInputChange,
  onSubmitChat,
  onSuggestion,
}: AgentSidebarProps) {
  const nextActions = currentTask?.nextActions ?? [];

  return (
    <aside
      id="agent-sidebar"
      className={isOpen ? 'agent-sidebar' : 'agent-sidebar agent-sidebar-hidden'}
      aria-label="Agent chat sidebar"
      aria-hidden={!isOpen}
    >
      <div className="agent-sidebar-header">
        <div>
          <p className="section-kicker">Assistant</p>
          <strong>设计协作</strong>
          <p>围绕当前画布持续推进任务，随时接管、追问或修正 agent 的方向。</p>
        </div>
        <div className="agent-sidebar-actions">
          <span className="status-pill">{sessionCount} 个会话</span>
          <button className="ghost-btn" type="button" onClick={onCreateSession}>
            新任务
          </button>
          <button className="ghost-btn" type="button" onClick={onClose} aria-label="收起聊天面板">
            收起
          </button>
        </div>
      </div>

      {currentTask ? (
        <section className="agent-task-card" aria-label="当前任务">
          <div className="panel-row">
            <strong>当前任务</strong>
            <span className="status-pill status-pill-soft">{currentTask.intentLabel}</span>
          </div>
          <h2>{currentTask.title}</h2>
          <div className="agent-task-status-row">
            <span className="agent-task-chip">{currentTask.intentLabel}</span>
            <span className="agent-task-chip agent-task-chip-accent">{currentTask.statusLabel}</span>
          </div>
          <p>{currentTask.summary}</p>
        </section>
      ) : null}

      {currentTask ? (
        <section className="agent-task-section" aria-label="执行过程">
          <div className="panel-row">
            <strong>执行过程</strong>
            <span>{currentTask.timeline.length} 个步骤</span>
          </div>
          <ol className="agent-task-timeline">
            {currentTask.timeline.map((item) => (
              <li
                key={item.id}
                className={
                  item.status === 'done'
                    ? 'agent-task-timeline-item done'
                    : item.status === 'current'
                      ? 'agent-task-timeline-item current'
                      : item.status === 'failed'
                        ? 'agent-task-timeline-item failed'
                        : 'agent-task-timeline-item'
                }
              >
                <span className="agent-task-timeline-marker" aria-hidden="true" />
                <span>{item.label}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {activeSession && nextActions.length > 0 ? (
        <section className="agent-task-section" aria-label="下一步">
          <div className="panel-row">
            <strong>下一步</strong>
            <span>{nextActions.length} 个建议</span>
          </div>
          <div className="chat-suggestions agent-next-actions">
            {nextActions.map((suggestion) => (
              <button
                key={suggestion.id}
                className="chat-suggestion-btn"
                type="button"
                onClick={() => onSuggestion(suggestion.action)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {sessionHistory.length > 0 ? (
        <section className="agent-task-section" aria-label="历史任务">
          <div className="panel-row">
            <strong>历史任务</strong>
            <span>{sessionHistory.length} 条</span>
          </div>
          <div className="agent-session-list">
            {sessionHistory.map((session) => (
              <button
                key={session.id}
                className={session.id === activeSessionId ? 'agent-session-item active' : 'agent-session-item'}
                type="button"
                onClick={() => onActivateSession(session.id)}
              >
                <strong>{session.title}</strong>
                <span>{session.subtitle}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeSession ? (
        <div className="chat-thread-wrap">
          <div className="panel-row">
            <strong>对话记录</strong>
            <span>{activeSession.messages.length} 条消息</span>
          </div>
          <div className="chat-thread" ref={chatThreadRef}>
            {activeSession.messages.map((message) => (
              <article
                key={message.id}
                className={message.role === 'assistant' ? 'chat-message chat-message-assistant' : 'chat-message chat-message-user'}
              >
                <div className="chat-meta">
                  <strong>{message.role === 'assistant' ? '设计助理' : '你'}</strong>
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-empty-state">
          <strong>暂无任务</strong>
          <p>从这里开始首版生成或围绕当前画布继续修改。你也可以直接输入消息，系统会自动创建一个新的任务线程。</p>
          {sessions.length > 0 ? (
            <div className="agent-session-list">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className={session.id === activeSessionId ? 'agent-session-item active' : 'agent-session-item'}
                  type="button"
                  onClick={() => onActivateSession(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span>{session.messages.length} 条消息</span>
                </button>
              ))}
            </div>
          ) : null}
          <button className="ghost-btn ghost-btn-dark" type="button" onClick={onCreateSession}>
            新任务
          </button>
        </div>
      )}

      <form
        className="agent-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (voiceComposer.status !== 'idle') {
            return;
          }
          onSubmitChat();
        }}
      >
        <textarea
          className="text-input chat-input"
          aria-label="发送给设计助理"
          placeholder={activeSession ? '继续当前任务，或告诉 agent 如何调整方向' : '描述你想启动的任务，系统会自动创建任务线程'}
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
        />
        <div className="agent-composer-footer">
          <span
            className={voiceComposer.errorMessage ? 'agent-composer-status agent-composer-status-error' : 'agent-composer-status'}
            role={voiceComposer.errorMessage ? 'alert' : 'status'}
          >
            {voiceComposer.errorMessage ?? composerStatusText}
          </span>
          <div className="agent-composer-actions">
            <button
              className={
                voiceComposer.status === 'recording'
                  ? 'ghost-btn ghost-btn-dark agent-voice-btn agent-voice-btn-recording'
                  : voiceComposer.status === 'transcribing'
                    ? 'ghost-btn ghost-btn-dark agent-voice-btn agent-voice-btn-transcribing'
                    : 'ghost-btn ghost-btn-dark agent-voice-btn'
              }
              type="button"
              onClick={() => {
                void voiceComposer.toggleRecording();
              }}
              aria-label={voiceComposer.status === 'recording' ? '停止录音' : voiceComposer.status === 'transcribing' ? '正在转写' : '开始录音'}
              aria-pressed={voiceComposer.status === 'recording'}
              disabled={voiceComposer.status === 'transcribing'}
            >
              {voiceButtonLabel}
            </button>
            <button className="ghost-btn ghost-btn-dark" type="submit" disabled={voiceComposer.status !== 'idle' || !chatInput.trim()}>
              发送
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
