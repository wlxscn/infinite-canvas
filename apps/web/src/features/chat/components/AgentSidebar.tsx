import type { RefObject } from 'react';
import type { ChatSuggestionAction } from '@infinite-canvas/shared/chat';
import type { AssetRecord, CanvasNode, ChatSession, GenerationJob } from '../../../types/canvas';
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
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  selectedNode: CanvasNode | null;
  selectedAsset: AssetRecord | null;
  latestJob: GenerationJob | null;
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
  activeSessionId,
  activeSession,
  selectedNode,
  selectedAsset,
  latestJob,
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
          <strong>设计对话</strong>
          <p>先在这里描述你想生成的内容，再围绕当前画布继续细化与迭代。</p>
        </div>
        <div className="agent-sidebar-actions">
          <span className="status-pill">{sessionCount} 个会话</span>
          <button className="ghost-btn" type="button" onClick={onCreateSession}>
            新建会话
          </button>
          <button className="ghost-btn" type="button" onClick={onClose} aria-label="收起聊天面板">
            收起
          </button>
        </div>
      </div>

      {sessionCount > 0 ? (
        <section className="agent-session-list">
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
        </section>
      ) : null}

      {selectedNode || selectedAsset || latestJob ? (
        <section className="agent-context-card">
          <div className="panel-row">
            <strong>当前上下文</strong>
            <span>{selectedNode?.type ?? latestJob?.mediaType ?? latestJob?.status ?? 'idle'}</span>
          </div>
          {selectedNode ? <p>已选中 {selectedNode.type} 节点，可继续补文字、改风格或生成变体。</p> : null}
          {selectedAsset ? <p>当前关联资产：{selectedAsset.name} ({selectedAsset.type === 'video' ? '视频' : '图片'})</p> : null}
          {!selectedNode && !selectedAsset && latestJob ? <p>最近一次生成主题：{latestJob.prompt}</p> : null}
        </section>
      ) : null}

      {activeSession ? (
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
              {message.suggestions.length > 0 ? (
                <div className="chat-suggestions">
                  {message.suggestions.map((suggestion) => (
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
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="chat-empty-state">
          <strong>暂无会话</strong>
          <p>从这里开始首版生成或围绕当前画布继续修改。你也可以直接输入消息，系统会自动创建会话。</p>
          <button className="ghost-btn ghost-btn-dark" type="button" onClick={onCreateSession}>
            新建会话
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
          placeholder="例如：生成一张极简科技海报，或把当前标题改得更大胆"
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
