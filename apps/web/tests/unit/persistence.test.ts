import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasRenderRuntime } from '@infinite-canvas/canvas-engine';
import { createDeferredProjectSaver, getProjectStorageKey, loadProject, saveProject, STORAGE_KEY } from '../../src/persistence/local';
import {
  createProjectSummary,
  DEFAULT_PROJECT_TITLE,
  loadRecentProjectSummaries,
  RECENT_PROJECTS_STORAGE_KEY,
  upsertRecentProjectSummary,
} from '../../src/persistence/project-management';
import {
  createProjectId,
  getProjectIdFromUrl,
  PROJECT_ID_STORAGE_KEY,
  resolveProjectId,
  setProjectIdInUrl,
  storeProjectId,
} from '../../src/persistence/project-id';
import {
  createRemoteProject,
  loadRemoteProject,
  loadRemoteProjectSummaries,
  RemoteProjectNotFoundError,
  renameRemoteProject,
  saveRemoteProject,
} from '../../src/persistence/remote';
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
      src: 'https://media.example.com/generated/video.mp4',
      frameSrc: 'data:image/jpeg;base64,frame',
      posterSrc: 'https://media.example.com/generated/poster.jpg',
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
    expect(loaded.assets[0].posterSrc).toBe('https://media.example.com/generated/poster.jpg');
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

  it('normalizes stored v2 nodes that predate rotation fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        board: {
          version: 2,
          viewport: { tx: 0, ty: 0, scale: 1 },
          nodes: [
            {
              id: 'rect_1',
              type: 'rect',
              x: 10,
              y: 20,
              w: 100,
              h: 80,
              stroke: '#000',
            },
            {
              id: 'group_1',
              type: 'group',
              x: 100,
              y: 120,
              w: 240,
              h: 180,
              children: [
                {
                  id: 'text_1',
                  type: 'text',
                  x: 24,
                  y: 24,
                  w: 120,
                  h: 60,
                  text: 'legacy',
                  color: '#111',
                  fontSize: 16,
                  fontFamily: 'sans-serif',
                },
              ],
            },
          ],
        },
        assets: [],
        jobs: [],
      }),
    );

    const project = loadProject();
    expect((project.board.nodes[0] as Extract<(typeof project.board.nodes)[number], { type: 'rect' }>).rotation).toBe(0);
    expect((project.board.nodes[1] as Extract<(typeof project.board.nodes)[number], { type: 'group' }>).rotation).toBe(0);
    const child = (project.board.nodes[1] as Extract<(typeof project.board.nodes)[number], { type: 'group' }>).children[0];
    expect((child as Extract<typeof child, { type: 'text' }>).rotation).toBe(0);
  });

  it('preserves curved connector fields across save and load', () => {
    const project = createEmptyProject();
    project.board.nodes = [
      {
        id: 'node_rect_a',
        type: 'rect',
        x: 40,
        y: 40,
        w: 120,
        h: 80,
        rotation: 0,
        stroke: '#000',
      },
      {
        id: 'node_rect_b',
        type: 'rect',
        x: 300,
        y: 60,
        w: 140,
        h: 100,
        rotation: 0,
        stroke: '#000',
      },
      {
        id: 'connector_curve_1',
        type: 'connector',
        start: {
          kind: 'attached',
          nodeId: 'node_rect_a',
          anchor: 'east',
        },
        end: {
          kind: 'attached',
          nodeId: 'node_rect_b',
          anchor: 'west',
        },
        pathMode: 'curve',
        curveControl: { x: 210, y: 24 },
        stroke: '#c44e1c',
        width: 2,
      },
    ];

    saveProject(project);

    const loaded = loadProject();
    const connector = loaded.board.nodes.find((node) => node.id === 'connector_curve_1');
    expect(connector).toMatchObject({
      type: 'connector',
      pathMode: 'curve',
      curveControl: { x: 210, y: 24 },
    });
  });

  it('keeps legacy curved connector data readable when pathMode is omitted', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        board: {
          version: 2,
          viewport: { tx: 0, ty: 0, scale: 1 },
          nodes: [
            {
              id: 'connector_curve_legacy',
              type: 'connector',
              start: { kind: 'free', x: 40, y: 120 },
              end: { kind: 'free', x: 260, y: 120 },
              curveControl: { x: 150, y: 36 },
              stroke: '#c44e1c',
              width: 2,
            },
          ],
        },
        assets: [],
        jobs: [],
      }),
    );

    const project = loadProject();
    const connector = project.board.nodes.find((node) => node.id === 'connector_curve_legacy');
    expect(connector).toMatchObject({
      type: 'connector',
      curveControl: { x: 150, y: 36 },
    });
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

  it('creates and reuses a stable backend project id', () => {
    const projectId = resolveProjectId();

    expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(localStorage.getItem(PROJECT_ID_STORAGE_KEY)).toBe(projectId);
    expect(resolveProjectId()).toBe(projectId);
  });

  it('prefers project ids from the current URL and stores them locally', () => {
    const location = new URL('https://example.com/canvas?projectId=11111111-1111-4111-8111-111111111111') as unknown as Location;

    const projectId = resolveProjectId(localStorage, location);

    expect(projectId).toBe('11111111-1111-4111-8111-111111111111');
    expect(localStorage.getItem(PROJECT_ID_STORAGE_KEY)).toBe(projectId);
  });

  it('can attach a saved project id to the current URL', () => {
    const replaceState = vi.fn();
    const history = { state: { current: true }, replaceState } as unknown as History;
    const location = new URL('https://example.com/canvas?view=board#top') as unknown as Location;

    setProjectIdInUrl('11111111-1111-4111-8111-111111111111', history, location);

    expect(replaceState).toHaveBeenCalledWith(
      { current: true },
      '',
      '/canvas?view=board&projectId=11111111-1111-4111-8111-111111111111#top',
    );
  });

  it('ignores invalid project ids in the current URL', () => {
    const location = new URL('https://example.com/canvas?projectId=local-project') as unknown as Location;

    expect(getProjectIdFromUrl(location)).toBeNull();
  });

  it('replaces invalid stored project ids', () => {
    localStorage.setItem(PROJECT_ID_STORAGE_KEY, 'local-project');

    const projectId = resolveProjectId();

    expect(projectId).not.toBe('local-project');
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('stores project ids explicitly when switching projects', () => {
    const projectId = createProjectId();

    storeProjectId(projectId);

    expect(localStorage.getItem(PROJECT_ID_STORAGE_KEY)).toBe(projectId);
  });

  it('saves and loads project snapshots per project id', () => {
    const firstProjectId = '11111111-1111-4111-8111-111111111111';
    const secondProjectId = '22222222-2222-4222-8222-222222222222';
    const firstProject = createEmptyProject();
    const secondProject = createEmptyProject();
    firstProject.chat.sessions.push({
      id: 'session_a',
      title: '项目 A',
      createdAt: 1,
      updatedAt: 1,
      messages: [],
    });
    secondProject.chat.sessions.push({
      id: 'session_b',
      title: '项目 B',
      createdAt: 2,
      updatedAt: 2,
      messages: [],
    });

    saveProject(firstProject, firstProjectId);
    saveProject(secondProject, secondProjectId);

    expect(loadProject(firstProjectId).chat.sessions[0].title).toBe('项目 A');
    expect(loadProject(secondProjectId).chat.sessions[0].title).toBe('项目 B');
    expect(localStorage.getItem(getProjectStorageKey(firstProjectId))).toBeTruthy();
    expect(localStorage.getItem(getProjectStorageKey(secondProjectId))).toBeTruthy();
  });

  it('keeps a recent-project summary index for local canvas management', () => {
    const projectId = '11111111-1111-4111-8111-111111111111';

    upsertRecentProjectSummary(createProjectSummary(projectId, { title: '封面草图' }));

    const summaries = loadRecentProjectSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].title).toBe('封面草图');
    expect(localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY)).toContain(projectId);
  });

  it('sorts recent canvas summaries by creation time descending', () => {
    upsertRecentProjectSummary(
      createProjectSummary('11111111-1111-4111-8111-111111111111', {
        title: '较早创建',
        createdAt: '2026-04-20T00:00:00.000Z',
      }),
    );
    upsertRecentProjectSummary(
      createProjectSummary('22222222-2222-4222-8222-222222222222', {
        title: '较晚创建',
        createdAt: '2026-04-22T00:00:00.000Z',
      }),
    );

    const summaries = loadRecentProjectSummaries();

    expect(summaries.map((summary) => summary.title)).toEqual(['较晚创建', '较早创建']);
  });

  it('loads remote projects from the project endpoint beside chat', async () => {
    const project = createEmptyProject();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ projectId: '11111111-1111-4111-8111-111111111111', title: DEFAULT_PROJECT_TITLE, project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await loadRemoteProject('11111111-1111-4111-8111-111111111111');

    expect(response.project).toEqual(project);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/projects/11111111-1111-4111-8111-111111111111', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: undefined,
    });
  });

  it('deduplicates in-flight remote project loads for the same project id', async () => {
    const project = createEmptyProject();
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchMock);

    const first = loadRemoteProject('11111111-1111-4111-8111-111111111111');
    const second = loadRemoteProject('11111111-1111-4111-8111-111111111111');

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify({ projectId: '11111111-1111-4111-8111-111111111111', project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(first).resolves.toEqual({ projectId: '11111111-1111-4111-8111-111111111111', project });
  });

  it('does not share abortable remote project loads between StrictMode mounts', async () => {
    const project = createEmptyProject();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ projectId: '11111111-1111-4111-8111-111111111111', title: DEFAULT_PROJECT_TITLE, project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = loadRemoteProject('11111111-1111-4111-8111-111111111111', { signal: firstController.signal });
    const second = loadRemoteProject('11111111-1111-4111-8111-111111111111', { signal: secondController.signal });

    expect(first).not.toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8787/projects/11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ signal: firstController.signal }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/projects/11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ signal: secondController.signal }),
    );

    await expect(first).resolves.toEqual({
      projectId: '11111111-1111-4111-8111-111111111111',
      title: DEFAULT_PROJECT_TITLE,
      project,
    });
    await expect(second).resolves.toEqual({
      projectId: '11111111-1111-4111-8111-111111111111',
      title: DEFAULT_PROJECT_TITLE,
      project,
    });
  });

  it('maps missing remote projects to a recoverable not-found error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'not found' }), { status: 404 })));

    await expect(loadRemoteProject('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(RemoteProjectNotFoundError);
  });

  it('saves remote projects without affecting local fallback behavior', async () => {
    const project = createEmptyProject();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ projectId: '11111111-1111-4111-8111-111111111111', title: DEFAULT_PROJECT_TITLE, project }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await saveRemoteProject('11111111-1111-4111-8111-111111111111', project);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ project });
  });

  it('loads remote project summaries from the collection endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            projects: [
              {
                projectId: '11111111-1111-4111-8111-111111111111',
                title: '海报方案',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const result = await loadRemoteProjectSummaries();

    expect(result.projects[0].title).toBe('海报方案');
  });

  it('creates remote projects through the collection endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          projectId: '11111111-1111-4111-8111-111111111111',
          title: '新的画布',
          project: createEmptyProject(),
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createRemoteProject('新的画布');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8787/projects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ title: '新的画布' });
  });

  it('renames remote projects through the metadata endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          projectId: '11111111-1111-4111-8111-111111111111',
          title: '重命名后的画布',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await renameRemoteProject('11111111-1111-4111-8111-111111111111', '重命名后的画布');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ title: '重命名后的画布' });
  });
});
