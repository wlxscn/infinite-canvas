import { describe, expect, it } from 'vitest';
import { deriveCurrentTask, deriveSessionHistoryEntries } from '../../src/features/chat/deriveCurrentTask';
import type { AgentResponseData } from '../../src/features/chat/mappers/chat-mapper';
import type { ChatSession, GenerationJob } from '../../src/types/canvas';

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session_1',
    title: '新会话',
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    conversationId: undefined,
    previousResponseId: null,
    ...overrides,
  };
}

function createResponseData(overrides: Partial<AgentResponseData> = {}): AgentResponseData {
  return {
    suggestions: [],
    effects: [],
    conversationId: undefined,
    previousResponseId: undefined,
    ...overrides,
  };
}

function createJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'job_1',
    prompt: '生成一只狗',
    mediaType: 'image',
    status: 'pending',
    createdAt: 10,
    updatedAt: 12,
    ...overrides,
  };
}

describe('deriveCurrentTask', () => {
  it('returns null when there is no active session', () => {
    expect(
      deriveCurrentTask({
        activeSession: null,
        responseData: null,
        jobs: [],
        chatStatus: 'ready',
        chatError: null,
      }),
    ).toBeNull();
  });

  it('derives a chat-only task when assistant replies with plain text and no effects', () => {
    const task = deriveCurrentTask({
      activeSession: createSession({
        messages: [
          { id: 'u1', role: 'user', text: '你是谁', createdAt: 1, suggestions: [] },
          { id: 'a1', role: 'assistant', text: '我是你的设计助理。', createdAt: 2, suggestions: [] },
        ],
      }),
      responseData: null,
      jobs: [],
      chatStatus: 'ready',
      chatError: null,
    });

    expect(task?.intent).toBe('chat');
    expect(task?.status).toBe('completed');
    expect(task?.title).toBe('你是谁');
    expect(task?.timeline[2]?.label).toContain('本轮仅对话');
  });

  it('prefers structured effects and matching jobs to derive a generating image task', () => {
    const task = deriveCurrentTask({
      activeSession: createSession({
        messages: [
          { id: 'u1', role: 'user', text: '生成一只狗', createdAt: 1, suggestions: [] },
          { id: 'a1', role: 'assistant', text: '已准备生成图像。', createdAt: 2, suggestions: [] },
        ],
      }),
      responseData: createResponseData({
        suggestions: [{ id: 's1', label: '继续生成变体', action: 'generate-variants' }],
        effects: [{ type: 'start-generation', prompt: '生成一只狗', mediaType: 'image' }],
      }),
      jobs: [createJob()],
      chatStatus: 'ready',
      chatError: null,
    });

    expect(task?.intent).toBe('generate-image');
    expect(task?.status).toBe('generating');
    expect(task?.latestJobId).toBe('job_1');
    expect(task?.nextActions).toHaveLength(1);
    expect(task?.timeline[2]?.status).toBe('current');
  });

  it('maps failed chat transport or generation state to a failed task', () => {
    const task = deriveCurrentTask({
      activeSession: createSession({
        messages: [{ id: 'u1', role: 'user', text: '生成封面', createdAt: 1, suggestions: [] }],
      }),
      responseData: createResponseData({
        effects: [{ type: 'start-generation', prompt: '生成封面', mediaType: 'image' }],
      }),
      jobs: [createJob({ prompt: '生成封面', status: 'failed', error: 'image generation failed' })],
      chatStatus: 'error',
      chatError: new Error('服务端超时'),
    });

    expect(task?.status).toBe('failed');
    expect(task?.summary).toContain('服务端超时');
    expect(task?.timeline[2]?.status).toBe('failed');
  });
});

describe('deriveSessionHistoryEntries', () => {
  it('lists non-active sessions as history entries sorted by recent update', () => {
    const entries = deriveSessionHistoryEntries(
      [
        createSession({ id: 'session_old', title: '旧方向', updatedAt: 2, messages: [{ id: 'm1', role: 'user', text: '旧方向', createdAt: 1, suggestions: [] }] }),
        createSession({ id: 'session_new', title: '当前任务', updatedAt: 5, messages: [{ id: 'm2', role: 'user', text: '当前任务', createdAt: 2, suggestions: [] }] }),
        createSession({ id: 'session_mid', title: '备用方向', updatedAt: 3, messages: [{ id: 'm3', role: 'assistant', text: '换一个风格。', createdAt: 2, suggestions: [] }] }),
      ],
      'session_new',
    );

    expect(entries.map((entry) => entry.id)).toEqual(['session_mid', 'session_old']);
    expect(entries[0]?.subtitle).toContain('换一个风格');
  });
});
