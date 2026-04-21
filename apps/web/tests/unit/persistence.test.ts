import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasRenderRuntime } from '@infinite-canvas/canvas-engine';
import { createDeferredProjectSaver, loadProject, saveProject, STORAGE_KEY } from '../../src/persistence/local';
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

  it('preserves video assets and generation job metadata', () => {
    const project = createEmptyProject();
    project.assets.push({
      id: 'asset_video_1',
      type: 'video',
      name: 'motion',
      mimeType: 'video/mp4',
      src: 'https://example.com/video.mp4',
      frameSrc: 'data:image/jpeg;base64,frame',
      posterSrc: 'https://example.com/poster.jpg',
      width: 1920,
      height: 1080,
      durationSeconds: 12,
      origin: 'generated',
      createdAt: 3,
      sourceJobId: 'job_1',
    });
    project.jobs.push({
      id: 'job_1',
      prompt: 'hero motion',
      mediaType: 'video',
      status: 'success',
      createdAt: 3,
      updatedAt: 4,
      assetId: 'asset_video_1',
    });

    saveProject(project);

    const loaded = loadProject();
    expect(loaded.assets[0].type).toBe('video');
    expect(loaded.assets[0].frameSrc).toBe('data:image/jpeg;base64,frame');
    expect(loaded.assets[0].posterSrc).toBe('https://example.com/poster.jpg');
    expect(loaded.jobs[0].mediaType).toBe('video');
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

  it('rebuilds runtime render state from persisted assets without storing engine caches', () => {
    const project = createEmptyProject();
    project.assets.push({
      id: 'asset_image_1',
      type: 'image',
      name: 'Poster',
      mimeType: 'image/png',
      src: 'data:image/png;base64,abc',
      width: 800,
      height: 600,
      origin: 'upload',
      createdAt: 5,
    });

    saveProject(project);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.assetMap).toBeUndefined();
    expect(stored.runtime).toBeUndefined();

    const loaded = loadProject();
    const runtime = createCanvasRenderRuntime(loaded.assets);

    expect(runtime.assetMap.get('asset_image_1')?.name).toBe('Poster');
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

  it('defers automatic saves and only writes the latest scheduled project', () => {
    vi.useFakeTimers();

    const save = vi.fn();
    const saver = createDeferredProjectSaver({ delayMs: 100, save });
    const projectA = createEmptyProject();
    const projectB = {
      ...createEmptyProject(),
      board: {
        ...createEmptyProject().board,
        viewport: { tx: 20, ty: 10, scale: 1.2 },
      },
    };

    saver.schedule(projectA);
    saver.schedule(projectB);

    vi.advanceTimersByTime(99);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(projectB);

    vi.useRealTimers();
  });

  it('can flush a deferred save immediately', () => {
    vi.useFakeTimers();

    const save = vi.fn();
    const saver = createDeferredProjectSaver({ delayMs: 100, save });
    const project = createEmptyProject();

    saver.schedule(project);
    saver.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(project);

    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
