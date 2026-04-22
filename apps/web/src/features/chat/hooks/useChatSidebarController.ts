import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AgentChatRequest } from '@infinite-canvas/shared/api';
import type { CanvasContextPayload } from '@infinite-canvas/shared/canvas-context';
import type { ChatMessage, ChatSuggestionAction } from '@infinite-canvas/shared/chat';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import { useAgentChat } from './useAgentChat';
import { mergeTranscriptIntoDraft, useVoiceComposer } from './useVoiceComposer';
import { appendMessagesToSession, createChatSession, getActiveChatSession, updateActiveSession, updateSessionById } from '../session-state';
import { deriveCurrentTask, deriveSessionHistoryEntries } from '../deriveCurrentTask';
import { dedupeChatSuggestions } from '../mappers/chat-mapper';
import type { AgentResponseData } from '../mappers/chat-mapper';
import { replaceProjectNoHistory } from '../../../state/store';
import type { CanvasNode, CanvasProject, CanvasStoreState, ChatSession } from '../../../types/canvas';
import { createId } from '../../../utils/id';

function logSidebarChat(event: string, payload: Record<string, unknown> = {}) {
  console.log(`[web/chat-sidebar] ${event}`, payload);
}

function makeUserMessage(text: string): ChatMessage {
  return {
    id: createId('message'),
    role: 'user',
    text,
    createdAt: Date.now(),
    suggestions: [],
    effects: [],
  };
}

interface UseChatSidebarControllerOptions {
  projectId: string;
  project: CanvasProject;
  selectedNode: CanvasNode | null;
  setState: Dispatch<SetStateAction<CanvasStoreState>>;
  onApplyEffects: (effects: AgentEffect[]) => void;
  buildCanvasContext: (project: CanvasProject, selectedNode: CanvasNode | null) => CanvasContextPayload;
}

export function useChatSidebarController({
  projectId,
  project,
  selectedNode,
  setState,
  onApplyEffects,
  buildCanvasContext,
}: UseChatSidebarControllerOptions) {
  const [chatInput, setChatInput] = useState('');
  const [latestResponseDataBySession, setLatestResponseDataBySession] = useState<Record<string, AgentResponseData | null>>({});
  const activeSession = useMemo(() => getActiveChatSession(project), [project]);
  const activeSessionRef = useRef<ChatSession | null>(activeSession);
  const selectedNodeRef = useRef<CanvasNode | null>(selectedNode);
  const projectRef = useRef(project);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const agentChat = useAgentChat({
    initialMessages: activeSession?.messages ?? [],
    onResponseData({ responseData, targetSessionId }) {
      logSidebarChat('assistant:data', {
        suggestionCount: responseData?.suggestions.length ?? 0,
        effectCount: responseData?.effects.length ?? 0,
        conversationId: responseData?.conversationId,
        previousResponseId: responseData?.previousResponseId,
      });

      if (targetSessionId) {
        setLatestResponseDataBySession((prev) => ({
          ...prev,
          [targetSessionId]: {
            suggestions: dedupeChatSuggestions([...(prev[targetSessionId]?.suggestions ?? []), ...(responseData?.suggestions ?? [])]),
            effects: [...(prev[targetSessionId]?.effects ?? []), ...(responseData?.effects ?? [])],
            conversationId: responseData?.conversationId ?? prev[targetSessionId]?.conversationId,
            previousResponseId: responseData?.previousResponseId ?? prev[targetSessionId]?.previousResponseId,
          },
        }));

        setState((prev) =>
          replaceProjectNoHistory(
            prev,
            updateSessionById(prev.project, targetSessionId, (session) => {
              let didUpdateAssistant = false;
              const messages = [...session.messages]
                .reverse()
                .map((message) => {
                  if (didUpdateAssistant || message.role !== 'assistant') {
                    return message;
                  }

                  didUpdateAssistant = true;
                  return {
                    ...message,
                    suggestions: dedupeChatSuggestions([...(message.suggestions ?? []), ...(responseData?.suggestions ?? [])]),
                    effects: [...(message.effects ?? []), ...(responseData?.effects ?? [])],
                  };
                })
                .reverse();

              return {
                ...session,
                messages,
                conversationId: responseData?.conversationId ?? session.conversationId,
                previousResponseId: responseData?.previousResponseId ?? session.previousResponseId,
              };
            }),
          ),
        );
      }

      if (responseData?.effects?.length) {
        onApplyEffects(responseData.effects);
      }
    },
    onAssistantFinish({ message, responseData, targetSessionId }) {
      logSidebarChat('assistant:finish', {
        messageId: message.id,
        textLength: message.text.length,
        suggestionCount: responseData?.suggestions.length ?? message.suggestions.length,
        effectCount: responseData?.effects.length ?? 0,
        conversationId: responseData?.conversationId,
        previousResponseId: responseData?.previousResponseId,
      });

      setState((prev) =>
        replaceProjectNoHistory(
          prev,
          targetSessionId
            ? updateSessionById(prev.project, targetSessionId, (session) => ({
                ...appendMessagesToSession(session, {
                  ...message,
                  suggestions: dedupeChatSuggestions(responseData?.suggestions ?? message.suggestions),
                  effects: responseData?.effects ?? message.effects ?? [],
                }),
                title:
                  session.title === '新会话' && session.messages.length === 0 && message.text.trim().length > 0
                    ? message.text.trim().slice(0, 16)
                    : session.title,
                conversationId: responseData?.conversationId ?? session.conversationId,
                previousResponseId: responseData?.previousResponseId ?? session.previousResponseId,
              }))
            : prev.project,
        ),
      );

      if (targetSessionId) {
        setLatestResponseDataBySession((prev) => ({
          ...prev,
          [targetSessionId]: responseData
            ? {
                ...responseData,
                suggestions: dedupeChatSuggestions(responseData.suggestions),
              }
            : (prev[targetSessionId] ?? null),
        }));
      }
    },
    onError({ error, targetSessionId }) {
      logSidebarChat('assistant:error', {
        message: error.message,
      });

      if (targetSessionId) {
        setLatestResponseDataBySession((prev) => ({
          ...prev,
          [targetSessionId]: null,
        }));
      }
    },
  });

  const voiceComposer = useVoiceComposer({
    onTranscript(transcript) {
      setChatInput((currentDraft) => mergeTranscriptIntoDraft(currentDraft, transcript));
    },
  });

  const composerStatusText =
    voiceComposer.status === 'recording'
      ? '录音中，再次点按可停止并开始转写'
      : voiceComposer.status === 'transcribing'
        ? '正在转写语音，完成后会回填到输入框供你编辑'
        : '录音转写后可编辑再发送，消息会结合当前画布和最近操作';

  const voiceButtonLabel =
    voiceComposer.status === 'recording' ? '停止' : voiceComposer.status === 'transcribing' ? '转写中' : '录音';

  const currentTask = useMemo(
    () =>
      deriveCurrentTask({
        activeSession,
        responseData: activeSession ? latestResponseDataBySession[activeSession.id] ?? null : null,
        jobs: project.jobs,
        chatStatus: agentChat.status,
        chatError: agentChat.error ?? null,
      }),
    [activeSession, agentChat.error, agentChat.status, latestResponseDataBySession, project.jobs],
  );
  const streamingEffects = useMemo(
    () => (activeSession ? (latestResponseDataBySession[activeSession.id]?.effects ?? []) : []),
    [activeSession, latestResponseDataBySession],
  );
  const streamingAssistantMessage = useMemo<ChatMessage | null>(() => {
    if (!activeSession || !currentTask) {
      return agentChat.streamingAssistantMessage;
    }

    if (agentChat.streamingAssistantMessage) {
      return {
        ...agentChat.streamingAssistantMessage,
        effects:
          agentChat.streamingAssistantMessage.effects && agentChat.streamingAssistantMessage.effects.length > 0
            ? agentChat.streamingAssistantMessage.effects
            : streamingEffects,
      };
    }

    if (
      streamingEffects.length > 0 &&
      (currentTask.status === 'thinking' || currentTask.status === 'responding' || currentTask.status === 'generating')
    ) {
      return {
        id: `streaming-${activeSession.id}`,
        role: 'assistant',
        text: currentTask.summary,
        createdAt: currentTask.latestUserMessage?.createdAt ?? activeSession.updatedAt,
        suggestions: currentTask.nextActions,
        effects: streamingEffects,
      };
    }

    return null;
  }, [activeSession, agentChat.streamingAssistantMessage, currentTask, streamingEffects]);

  const sessionHistory = useMemo(
    () => deriveSessionHistoryEntries(project.chat.sessions, project.chat.activeSessionId),
    [project.chat.activeSessionId, project.chat.sessions],
  );

  function createAndActivateSession(title = '新会话') {
    const session = createChatSession(title);
    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        chat: {
          ...prev.project.chat,
          activeSessionId: session.id,
          sessions: [...prev.project.chat.sessions, session],
        },
      }),
    );
    return session;
  }

  function activateSession(sessionId: string): void {
    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        chat: {
          ...prev.project.chat,
          activeSessionId: sessionId,
        },
      }),
    );
  }

  async function submitChatMessage(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const currentProject = projectRef.current;
    const currentSelectedNode = selectedNodeRef.current;
    const currentActiveSession = activeSessionRef.current;
    const userMessage = makeUserMessage(trimmed);
    const session = currentActiveSession ?? createChatSession();
    const isNewSession = !currentActiveSession;
    const existingMessages = session.messages;
    const request: AgentChatRequest = {
      projectId,
      conversationId: session.conversationId,
      previousResponseId: session.previousResponseId ?? undefined,
      message: trimmed,
      history: [...existingMessages, userMessage],
      canvasContext: buildCanvasContext(currentProject, currentSelectedNode),
    };

    logSidebarChat('submit', {
      message: trimmed,
      conversationId: request.conversationId,
      previousResponseId: request.previousResponseId,
      historyCount: request.history?.length ?? 0,
      selectedNodeType: request.canvasContext.selectedNode?.type ?? null,
      latestPrompt: request.canvasContext.latestPrompt,
    });

    setLatestResponseDataBySession((prev) => ({
      ...prev,
      [session.id]: null,
    }));

    setChatInput('');
    setState((prev) =>
      replaceProjectNoHistory(
        prev,
        isNewSession
          ? {
              ...prev.project,
              chat: {
                ...prev.project.chat,
                activeSessionId: session.id,
                sessions: [
                  ...prev.project.chat.sessions,
                  appendMessagesToSession(
                    {
                      ...session,
                      title: trimmed.slice(0, 16) || session.title,
                    },
                    userMessage,
                  ),
                ],
              },
            }
          : updateActiveSession(prev.project, (currentSession) =>
              appendMessagesToSession(
                {
                  ...currentSession,
                  title:
                    currentSession.title === '新会话' && currentSession.messages.length === 0
                      ? trimmed.slice(0, 16) || currentSession.title
                      : currentSession.title,
                },
                userMessage,
              ),
            ),
      ),
    );

    await agentChat.sendAgentMessage(trimmed, request, session.id);

    logSidebarChat('submit:completed', {
      message: trimmed,
    });
  }

  function handleSuggestion(action: ChatSuggestionAction): void {
    const suggestionMessage =
      action === 'add-text'
        ? '请帮我添加宣传文字'
        : action === 'change-style'
          ? '请帮我更换当前海报风格'
          : '请继续生成当前设计的系列变体';

    void submitChatMessage(suggestionMessage);
  }

  return {
    activeSession,
    chatInput,
    setChatInput,
    currentTask,
    streamingAssistantMessage,
    streamingEffects,
    sessionCount: project.chat.sessions.length,
    sessionHistory,
    voiceComposer,
    composerStatusText,
    voiceButtonLabel,
    createAndActivateSession,
    activateSession,
    submitChatMessage,
    handleSuggestion,
  };
}
