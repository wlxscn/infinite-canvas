import { beforeEach, describe, expect, it } from 'vitest';
import { loadProject, saveProject, STORAGE_KEY } from '../../src/persistence/local';
import { createEmptyProject } from '../../src/state/store';

describe('project persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads the v2 project format', () => {
    const project = createEmptyProject();
    project.assets.push({
      id: 'asset_1',
      type: 'image',
      name: 'hero',
      mimeType: 'image/png',
      src: 'data:image/png;base64,abc',
      width: 1200,
      height: 800,
      origin: 'generated',
      createdAt: 1,
    });
    project.chat.activeSessionId = 'session_1';
    project.chat.sessions.push({
      id: 'session_1',
      title: '新会话',
      createdAt: 2,
      updatedAt: 2,
      messages: [
        {
          id: 'message_1',
          role: 'assistant',
          text: 'ready to help',
          createdAt: 2,
          suggestions: [],
        },
      ],
      conversationId: 'conv_1',
      previousResponseId: 'resp_1',
    });

    saveProject(project);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').version).toBe(2);
    const loaded = loadProject();
    expect(loaded.assets).toHaveLength(1);
    expect(loaded.chat.sessions).toHaveLength(1);
    expect(loaded.chat.activeSessionId).toBe('session_1');
    expect(loaded.chat.sessions[0].messages[0].text).toBe('ready to help');
  });

  it('migrates legacy shape-only data', () => {
    localStorage.setItem(
      'infinite-canvas:v1',
      JSON.stringify({
        version: 1,
        viewport: { tx: 0, ty: 0, scale: 1 },
        shapes: [
          {
            id: 'legacy_rect',
            type: 'rect',
            x: 10,
            y: 12,
            w: 60,
            h: 40,
            stroke: '#000',
          },
        ],
      }),
    );

    const project = loadProject();
    expect(project.version).toBe(2);
    expect(project.board.nodes).toHaveLength(1);
    expect(project.board.nodes[0].type).toBe('rect');
    expect(project.chat.sessions).toEqual([]);
    expect(project.chat.activeSessionId).toBeNull();
  });

  it('normalizes stored v2 projects that predate chat state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        board: {
          version: 2,
          viewport: { tx: 0, ty: 0, scale: 1 },
          nodes: [],
        },
        assets: [],
        jobs: [],
      }),
    );

    const project = loadProject();
    expect(project.chat.sessions).toEqual([]);
    expect(project.chat.activeSessionId).toBeNull();
  });

  it('preserves service-backed session metadata when present', () => {
    const project = createEmptyProject();
    project.chat.activeSessionId = 'session_1';
    project.chat.sessions.push({
      id: 'session_1',
      title: '主会话',
      createdAt: 1,
      updatedAt: 1,
      messages: [],
      conversationId: 'conv_123',
      previousResponseId: 'resp_456',
    });

    saveProject(project);

    const loaded = loadProject();
    expect(loaded.chat.sessions[0].conversationId).toBe('conv_123');
    expect(loaded.chat.sessions[0].previousResponseId).toBe('resp_456');
  });

  it('does not surface legacy single-thread chat as a session', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        board: {
          version: 2,
          viewport: { tx: 0, ty: 0, scale: 1 },
          nodes: [],
        },
        assets: [],
        jobs: [],
        chat: {
          messages: [
            {
              id: 'legacy_message_1',
              role: 'assistant',
              text: 'legacy',
              createdAt: 1,
              suggestions: [],
            },
          ],
          conversationId: 'legacy_conv',
          previousResponseId: 'legacy_resp',
        },
      }),
    );

    const loaded = loadProject();
    expect(loaded.chat.sessions).toEqual([]);
    expect(loaded.chat.activeSessionId).toBeNull();
  });
});
