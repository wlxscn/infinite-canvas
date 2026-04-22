import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { ChatSuggestion, ChatSuggestionAction } from '@infinite-canvas/shared/chat';
import type { ChatSession } from '../../../types/canvas';
import type { DerivedCurrentTask, DerivedSessionHistoryEntry } from '../deriveCurrentTask';
import { MarkdownMessageBody } from './MarkdownMessageBody';
import { PlainTextMessageBody } from './PlainTextMessageBody';
import { useTypewriterText } from '../hooks/useTypewriterText';
import type { VoiceComposerStatus } from '../hooks/useVoiceComposer';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import { dedupeChatSuggestions } from '../mappers/chat-mapper';

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
  streamingAssistantMessage: ChatSession['messages'][number] | null;
  streamingEffects: AgentEffect[];
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
  streamingAssistantMessage,
  streamingEffects,
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
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const latestPersistedAssistantMessage = activeSession
    ? [...activeSession.messages].reverse().find((message) => message.role === 'assistant') ?? null
    : null;
  const displayedStreamingText = useTypewriterText(
    streamingAssistantMessage
      ? {
          id: streamingAssistantMessage.id,
          text: streamingAssistantMessage.text,
        }
      : null,
  );
  const isActiveStreamingTask =
    currentTask?.status === 'thinking' || currentTask?.status === 'responding' || currentTask?.status === 'generating';

  useEffect(() => {
    if (!chatThreadRef.current || !displayedStreamingText) {
      return;
    }

    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [chatThreadRef, displayedStreamingText]);

  const shouldRenderStreamingAssistant =
    isActiveStreamingTask &&
    !!streamingAssistantMessage &&
    (
      !latestPersistedAssistantMessage ||
      (
        latestPersistedAssistantMessage.id !== streamingAssistantMessage.id &&
        latestPersistedAssistantMessage.text !== streamingAssistantMessage.text
      )
    );

  const shouldUseTypewriterForPersistedMessage =
    isActiveStreamingTask &&
    !!streamingAssistantMessage &&
    !!latestPersistedAssistantMessage &&
    latestPersistedAssistantMessage.id === streamingAssistantMessage.id &&
    !!displayedStreamingText &&
    displayedStreamingText.length < latestPersistedAssistantMessage.text.length;

  function renderSuggestionChips(messageSuggestions: ChatSuggestion[]) {
    const uniqueSuggestions = dedupeChatSuggestions(messageSuggestions);

    if (!uniqueSuggestions.length) {
      return null;
    }

    return (
      <div className="chat-suggestions">
        {uniqueSuggestions.map((suggestion) => (
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
    );
  }

  function renderMessageBody(message: ChatSession['messages'][number]) {
    const shouldRenderPersistedTypewriter =
      message.role === 'assistant' &&
      latestPersistedAssistantMessage &&
      message.id === latestPersistedAssistantMessage.id &&
      shouldUseTypewriterForPersistedMessage;

    if (shouldRenderPersistedTypewriter) {
      return <PlainTextMessageBody text={displayedStreamingText} />;
    }

    if (message.role === 'assistant') {
      return <MarkdownMessageBody text={message.text} />;
    }

    return <PlainTextMessageBody text={message.text} />;
  }

  function renderMessageMedia(messageEffects: AgentEffect[] = []) {
    const mediaEffects = messageEffects.filter(
      (effect): effect is Extract<AgentEffect, { type: 'insert-image' | 'insert-video' }> =>
        effect.type === 'insert-image' || effect.type === 'insert-video',
    );

    const pendingMediaEffect = messageEffects.find(
      (effect): effect is Extract<AgentEffect, { type: 'start-generation' | 'style-variation' }> =>
        effect.type === 'start-generation' ||
        (effect.type === 'style-variation' && (effect.mediaType ?? 'image') === 'image') ||
        (effect.type === 'style-variation' && effect.mediaType === 'video'),
    );

    const pendingMediaType = pendingMediaEffect?.mediaType ?? 'image';

    if (!mediaEffects.length && !pendingMediaEffect) {
      return null;
    }

    return (
      <div className="chat-message-media-list">
        {mediaEffects.map((effect, index) =>
          effect.type === 'insert-image' ? (
            <figure key={`${effect.type}-${effect.imageUrl}-${index}`} className="chat-message-media-card">
              <img
                className="chat-message-media"
                src={effect.imageUrl}
                alt={effect.prompt || '生成图片'}
                loading="lazy"
              />
              {effect.prompt ? <figcaption>{effect.prompt}</figcaption> : null}
            </figure>
          ) : (
            <figure key={`${effect.type}-${effect.videoUrl}-${index}`} className="chat-message-media-card">
              <video
                className="chat-message-media"
                src={effect.videoUrl}
                poster={effect.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
              />
              {effect.prompt ? <figcaption>{effect.prompt}</figcaption> : null}
            </figure>
          ),
        )}
        {!mediaEffects.length && pendingMediaEffect ? (
          <div
            className={
              pendingMediaType === 'video'
                ? 'chat-message-media-placeholder chat-message-media-placeholder-video'
                : 'chat-message-media-placeholder'
            }
            aria-hidden="true"
          >
            <div className="chat-message-media-placeholder-shimmer" />
            <span className="chat-message-media-placeholder-label">生成中</span>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <aside
      id="agent-sidebar"
      className={isOpen ? 'agent-sidebar' : 'agent-sidebar agent-sidebar-hidden'}
      aria-label="Agent chat sidebar"
      aria-hidden={!isOpen}
    >
      <div className="agent-sidebar-header">
        <div className="agent-sidebar-heading">
          <p className="section-kicker">Assistant</p>
          <strong>{activeSession?.title ?? '新对话'}</strong>
          <p>{activeSession ? '围绕当前画布继续对话、追问和调整。' : '从这里开启新的设计对话。'}</p>
        </div>
        <div className="agent-sidebar-actions">
          <button className="ghost-btn" type="button" onClick={() => setIsHistoryExpanded((current) => !current)} aria-expanded={isHistoryExpanded}>
            {sessionCount} 个会话
          </button>
          <button className="ghost-btn" type="button" onClick={onCreateSession}>
            新对话
          </button>
          <button className="ghost-btn" type="button" onClick={onClose} aria-label="收起聊天面板">
            收起
          </button>
        </div>
      </div>

      {isHistoryExpanded ? (
        <>
          <button className="agent-session-popover-backdrop" type="button" aria-label="关闭会话列表" onClick={() => setIsHistoryExpanded(false)} />
          <section className="agent-session-popover" aria-label="历史会话">
            <div className="panel-row">
              <strong>历史会话</strong>
              <button className="agent-history-toggle" type="button" onClick={() => setIsHistoryExpanded(false)}>
                收起
              </button>
            </div>
            {sessionHistory.length > 0 ? (
              <div className="agent-session-list">
                {sessionHistory.map((session) => (
                  <button
                    key={session.id}
                    className={session.id === activeSessionId ? 'agent-session-item active' : 'agent-session-item'}
                    type="button"
                    onClick={() => {
                      onActivateSession(session.id);
                      setIsHistoryExpanded(false);
                    }}
                  >
                    <strong>{session.title}</strong>
                    <span>{session.subtitle}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="agent-session-empty">还没有其他历史会话。</div>
            )}
          </section>
        </>
      ) : null}

      {activeSession ? (
        <div className="chat-thread-wrap">
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
                {renderMessageBody(message)}
                {message.role === 'assistant' ? renderMessageMedia(message.effects) : null}
                {message.role === 'assistant' ? renderSuggestionChips(message.suggestions) : null}
              </article>
            ))}
            {shouldRenderStreamingAssistant && streamingAssistantMessage ? (
              <article className="chat-message chat-message-assistant chat-message-pending chat-message-streaming" aria-live="polite">
                <div className="chat-meta">
                  <strong>设计助理</strong>
                  <span>{currentTask?.statusLabel ?? '回复中'}</span>
                </div>
                <PlainTextMessageBody text={displayedStreamingText} />
                {renderMessageMedia(streamingAssistantMessage.effects)}
              </article>
            ) : currentTask && (currentTask.status === 'thinking' || currentTask.status === 'responding' || currentTask.status === 'generating') ? (
              <article className="chat-message chat-message-assistant chat-message-pending" aria-live="polite">
                <div className="chat-meta">
                  <strong>设计助理</strong>
                  <span>{currentTask.statusLabel}</span>
                </div>
                <PlainTextMessageBody text={currentTask.summary} />
                {renderMessageMedia(streamingEffects)}
              </article>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="chat-empty-state">
          <strong>开始新的设计对话</strong>
          <p>描述你想生成的画面、想调整的节点，或直接追问当前画布下一步怎么改。</p>
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
            新对话
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
          placeholder={activeSession ? '继续追问、修改方向，或直接描述下一步想做什么' : '给设计助理发送消息'}
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
