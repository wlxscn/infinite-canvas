import type { ChatMessage } from '@infinite-canvas/shared/chat';
import { createId } from '../../utils/id';
import type { CanvasProject, ChatSession } from '../../types/canvas';

export function createChatSession(title = '新会话'): ChatSession {
  const now = Date.now();
  return {
    id: createId('session'),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    conversationId: undefined,
    previousResponseId: null,
  };
}

export function getActiveChatSession(project: CanvasProject): ChatSession | null {
  if (!project.chat.activeSessionId) {
    return null;
  }

  return project.chat.sessions.find((session) => session.id === project.chat.activeSessionId) ?? null;
}

export function appendMessagesToSession(session: ChatSession, ...messages: ChatMessage[]): ChatSession {
  return {
    ...session,
    messages: [...session.messages, ...messages],
    updatedAt: Date.now(),
  };
}

export function updateSessionById(
  project: CanvasProject,
  sessionId: string,
  updater: (session: ChatSession) => ChatSession,
): CanvasProject {
  return {
    ...project,
    chat: {
      ...project.chat,
      sessions: project.chat.sessions.map((session) => (session.id === sessionId ? updater(session) : session)),
    },
  };
}

export function updateActiveSession(
  project: CanvasProject,
  updater: (session: ChatSession) => ChatSession,
): CanvasProject {
  if (!project.chat.activeSessionId) {
    return project;
  }

  return updateSessionById(project, project.chat.activeSessionId, updater);
}
