import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../src/state/store';
import { appendMessagesToSession, createChatSession, getActiveChatSession, updateSessionById } from '../../src/features/chat/session-state';

describe('chat session state helpers', () => {
  it('creates an empty session with session-scoped conversation metadata', () => {
    const session = createChatSession();

    expect(session.title).toBe('新会话');
    expect(session.messages).toEqual([]);
    expect(session.conversationId).toBeUndefined();
    expect(session.previousResponseId).toBeNull();
  });

  it('finds the active session from project chat state', () => {
    const project = createEmptyProject();
    const session = createChatSession('文案方向');
    project.chat.sessions.push(session);
    project.chat.activeSessionId = session.id;

    expect(getActiveChatSession(project)?.id).toBe(session.id);
  });

  it('updates only the targeted session when appending assistant messages', () => {
    const project = createEmptyProject();
    const first = createChatSession('会话 A');
    const second = createChatSession('会话 B');
    project.chat.sessions.push(first, second);
    project.chat.activeSessionId = first.id;

    const nextProject = updateSessionById(project, second.id, (session) =>
      appendMessagesToSession(session, {
        id: 'message_1',
        role: 'assistant',
        text: '只写入第二个会话',
        createdAt: 1,
        suggestions: [],
      }),
    );

    expect(nextProject.chat.sessions[0].messages).toEqual([]);
    expect(nextProject.chat.sessions[1].messages).toHaveLength(1);
    expect(nextProject.chat.sessions[1].messages[0].text).toBe('只写入第二个会话');
  });
});
