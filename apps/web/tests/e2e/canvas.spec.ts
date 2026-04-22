import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'infinite-canvas:v2';

function createSeedProject() {
  return {
    version: 2,
    board: {
      version: 2,
      viewport: { tx: 0, ty: 0, scale: 1 },
      nodes: [],
    },
    assets: [
      {
        id: 'asset_seed_1',
        type: 'image',
        name: 'Seed image',
        mimeType: 'image/png',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9VE3d2sAAAAASUVORK5CYII=',
        width: 1200,
        height: 800,
        origin: 'generated',
        createdAt: 1,
      },
    ],
    jobs: [],
    chat: {
      activeSessionId: 'session_seed_1',
      sessions: [
        {
          id: 'session_seed_1',
          title: '主会话',
          createdAt: 1,
          updatedAt: 1,
          messages: [
            {
              id: 'message_seed_1',
              role: 'user',
              text: '保留这个方向',
              createdAt: 1,
              suggestions: [],
            },
          ],
          conversationId: 'conv_seed_1',
          previousResponseId: null,
        },
      ],
    },
  };
}

function createEmptyChatSeedProject() {
  const project = createSeedProject();
  project.chat = {
    activeSessionId: null,
    sessions: [],
  };
  return project;
}

function buildChatSseResponse({
  requestId,
  text,
  suggestions = [],
  effects = [],
}: {
  requestId: string;
  text: string;
  suggestions?: Array<{ id: string; label: string; action: 'add-text' | 'change-style' | 'generate-variants' }>;
  effects?: Array<Record<string, unknown>>;
}) {
  const textId = `assistant-text-${requestId}`;
  return [
    { type: 'text-start', id: textId },
    { type: 'text-delta', id: textId, delta: text },
    { type: 'text-end', id: textId },
    {
      type: 'data-agentResponse',
      data: {
        suggestions,
        effects,
        conversationId: `conv_${requestId}`,
        previousResponseId: `resp_${requestId}`,
      },
    },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join('');
}

function createEngineSeedProject() {
  const project = createSeedProject();
  project.board.nodes = [
    {
      id: 'node_rect_seed',
      type: 'rect',
      x: 40,
      y: 40,
      w: 140,
      h: 100,
      stroke: '#111827',
      fill: 'rgba(59, 130, 246, 0.2)',
    },
    {
      id: 'node_freehand_seed',
      type: 'freehand',
      points: [
        { x: 220, y: 70 },
        { x: 260, y: 110 },
        { x: 320, y: 80 },
      ],
      stroke: '#0f172a',
      width: 3,
    },
    {
      id: 'node_text_seed',
      type: 'text',
      x: 360,
      y: 50,
      w: 180,
      h: 80,
      text: '新建文本',
      color: '#0f172a',
      fontSize: 20,
      fontFamily: 'Space Grotesk, sans-serif',
    },
    {
      id: 'node_image_seed',
      type: 'image',
      x: 120,
      y: 180,
      w: 160,
      h: 110,
      assetId: 'asset_seed_1',
    },
  ];
  return project;
}

function createSnapSeedProject() {
  const project = createSeedProject();
  project.board.nodes = [
    {
      id: 'node_rect_seed',
      type: 'rect',
      x: 320,
      y: 220,
      w: 140,
      h: 100,
      stroke: '#111827',
      fill: 'rgba(59, 130, 246, 0.2)',
    },
    {
      id: 'node_image_seed',
      type: 'image',
      x: 520,
      y: 360,
      w: 160,
      h: 110,
      assetId: 'asset_seed_1',
    },
  ];
  return project;
}

function createConnectorSeedProject() {
  const project = createSeedProject();
  project.board.nodes = [
    {
      id: 'node_rect_a',
      type: 'rect',
      x: 40,
      y: 40,
      w: 140,
      h: 100,
      stroke: '#111827',
      fill: 'rgba(59, 130, 246, 0.2)',
    },
    {
      id: 'node_rect_b',
      type: 'rect',
      x: 320,
      y: 60,
      w: 140,
      h: 100,
      stroke: '#111827',
      fill: 'rgba(20, 184, 166, 0.18)',
    },
    {
      id: 'node_rect_c',
      type: 'rect',
      x: 320,
      y: 240,
      w: 140,
      h: 100,
      stroke: '#111827',
      fill: 'rgba(244, 114, 182, 0.16)',
    },
  ];
  return project;
}

function createSelectionChromeSeedProject() {
  const project = createSeedProject();
  project.assets.push({
    id: 'asset_video_seed',
    type: 'video',
    name: 'Seed video',
    mimeType: 'video/mp4',
    src: 'data:video/mp4;base64,AAAA',
    frameSrc:
      'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20320%20180%22%3E%3Crect%20width=%22320%22%20height=%22180%22%20fill=%22%23111827%22/%3E%3Crect%20x=%2224%22%20y=%2224%22%20width=%22272%22%20height=%22132%22%20rx=%2212%22%20fill=%22%232563eb%22/%3E%3C/svg%3E',
    posterSrc: null,
    width: 1280,
    height: 720,
    origin: 'generated',
    createdAt: 2,
  });
  project.board.nodes = [
    {
      id: 'node_rect_seed',
      type: 'rect',
      x: 60,
      y: 60,
      w: 160,
      h: 110,
      stroke: '#111827',
      fill: 'rgba(59, 130, 246, 0.2)',
    },
    {
      id: 'node_video_seed',
      type: 'video',
      x: 280,
      y: 80,
      w: 180,
      h: 120,
      assetId: 'asset_video_seed',
    },
    {
      id: 'node_rect_target',
      type: 'rect',
      x: 520,
      y: 90,
      w: 150,
      h: 110,
      stroke: '#111827',
      fill: 'rgba(20, 184, 166, 0.18)',
    },
  ];
  return project;
}

function createRotationSeedProject() {
  const project = createSeedProject();
  project.board.nodes = [
    {
      id: 'group_rotation_seed',
      type: 'group',
      x: 60,
      y: 60,
      w: 220,
      h: 170,
      rotation: 0,
      name: '成组',
      children: [
        {
          id: 'node_rect_seed',
          type: 'rect',
          x: 24,
          y: 24,
          w: 140,
          h: 100,
          rotation: 0,
          stroke: '#111827',
          fill: 'rgba(59, 130, 246, 0.2)',
        },
      ],
    },
  ];
  return project;
}

function createGroupedRotationSeedProject() {
  const project = createSeedProject();
  project.board.nodes = [
    {
      id: 'group_seed',
      type: 'group',
      x: 60,
      y: 60,
      w: 240,
      h: 180,
      rotation: 0,
      name: '成组',
      children: [
        {
          id: 'node_rect_child',
          type: 'rect',
          x: 24,
          y: 24,
          w: 120,
          h: 90,
          rotation: 0,
          stroke: '#111827',
          fill: 'rgba(59, 130, 246, 0.2)',
        },
      ],
    },
    {
      id: 'node_rect_external',
      type: 'rect',
      x: 360,
      y: 110,
      w: 140,
      h: 100,
      rotation: 0,
      stroke: '#111827',
      fill: 'rgba(20, 184, 166, 0.18)',
    },
    {
      id: 'connector_seed',
      type: 'connector',
      start: {
        kind: 'attached',
        nodeId: 'node_rect_child',
        anchor: 'east',
      },
      end: {
        kind: 'attached',
        nodeId: 'node_rect_external',
        anchor: 'west',
      },
      stroke: '#c44e1c',
      width: 2,
    },
  ];
  return project;
}

test('can persist seeded sidebar sessions and local asset interactions after reload', async ({ page }) => {
  const sessionItems = page.locator('.agent-session-item');

  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSeedProject()]);

  await page.goto('/');

  await expect(page.getByRole('complementary', { name: '素材管理侧栏' })).toBeVisible();
  await expect(page.getByRole('button', { name: /展开\s*素材管理/i })).toBeVisible();
  await expect(page.getByRole('button', { name: '展开对话' })).toBeVisible();

  await page.getByRole('button', { name: /展开\s*素材管理/i }).click();
  await page.getByRole('button', { name: '展开对话' }).click();

  await expect(page.getByRole('complementary', { name: 'Agent chat sidebar' })).toBeVisible();
  await expect(page.getByText('主会话')).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();
  await expect(page.getByText(/资产 1/).first()).toBeVisible();
  await expect(page.getByText('先定一张主画面')).toHaveCount(0);

  await page.getByRole('button', { name: /Seed image/ }).click();
  await expect(page.getByText(/节点 1/)).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();

  await page.getByRole('button', { name: '新对话' }).first().click();
  await expect(page.getByText('新会话')).toBeVisible();
  await page.getByRole('button', { name: '2 个会话' }).click();
  await expect(sessionItems).toHaveCount(1);
  await sessionItems.first().click();
  await expect(page.getByText('保留这个方向')).toBeVisible();
  await page.waitForTimeout(250);

  await page.reload();

  await page.getByRole('button', { name: '展开对话' }).click();

  await expect(page.getByText(/资产 1/).first()).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();
});

test('can restore project-scoped sessions from backend project persistence after reload', async ({ page }) => {
  const remoteProject = createSeedProject();
  const projectId = '11111111-1111-4111-8111-111111111111';
  let saveCount = 0;

  await page.route(`**/projects/${projectId}`, async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          project: remoteProject,
          updatedAt: '2026-04-21T00:00:00.000Z',
        }),
      });
      return;
    }

    if (request.method() === 'PUT') {
      saveCount += 1;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          project: request.postDataJSON()?.project ?? remoteProject,
          updatedAt: '2026-04-21T00:00:01.000Z',
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/?projectId=${projectId}`);

  await page.getByRole('button', { name: '展开对话' }).click();

  await expect(page.getByRole('complementary', { name: 'Agent chat sidebar' })).toBeVisible();
  await expect(page.getByText('主会话')).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();
  await expect(page.getByText(/资产 1/).first()).toBeVisible();

  await page.reload();

  await page.getByRole('button', { name: '展开对话' }).click();

  await expect(page.getByText('主会话')).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();
  expect(saveCount).toBeGreaterThanOrEqual(0);
});

test('chat sidebar shows current task flow and suggestion-driven follow-ups after sending a message', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createEmptyChatSeedProject()]);

  await page.route('**/chat', async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { message?: string };
    const isFollowUp = body.message?.includes('系列变体');

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
      body: isFollowUp
        ? buildChatSseResponse({
            requestId: 'followup',
            text: '我会继续围绕当前方向延展两个新变体。',
            suggestions: [],
          })
        : buildChatSseResponse({
            requestId: 'initial',
            text: '我会先整理一个清晰的执行方向，并给你下一步建议。',
            suggestions: [{ id: 's1', label: '继续生成变体', action: 'generate-variants' }],
          }),
    });
  });

  await page.goto('/');

  await page.getByRole('button', { name: '展开对话' }).click();

  await page.getByLabel('发送给设计助理').fill('生成一只狗');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByText('生成一只狗').first()).toBeVisible();
  await expect(page.getByText('我会先整理一个清晰的执行方向，并给你下一步建议。')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续生成变体' })).toBeVisible();

  await page.getByRole('button', { name: '继续生成变体' }).click();

  await expect(page.getByText('请继续生成当前设计的系列变体')).toBeVisible();
  await expect(page.getByText('我会继续围绕当前方向延展两个新变体。')).toBeVisible();
});

test('asset sidebar can collapse and expand without hiding the canvas workspace', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSeedProject()]);

  await page.goto('/');

  await expect(page.getByRole('complementary', { name: '素材管理侧栏' })).toBeVisible();
  await expect(page.getByRole('button', { name: /展开\s*素材管理/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: /展开\s*素材管理/i }).click();
  await page.getByRole('button', { name: '收起素材栏' }).click();
  await expect(page.getByRole('button', { name: /展开\s*素材管理/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: /展开\s*素材管理/i }).click();
  await expect(page.getByRole('button', { name: '导入参考图' })).toBeVisible();
});

test('three-column workspace fills the available vertical height', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSeedProject()]);

  await page.goto('/');

  await page.getByRole('button', { name: /展开\s*素材管理/i }).click();
  await page.getByRole('button', { name: '展开对话' }).click();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  if (!viewport) {
    return;
  }

  const assetSidebarBox = await page.getByRole('complementary', { name: '素材管理侧栏' }).boundingBox();
  const canvasWorkspaceBox = await page.locator('.canvas-workspace').boundingBox();
  const agentSidebarBox = await page.getByRole('complementary', { name: 'Agent chat sidebar' }).boundingBox();

  expect(assetSidebarBox).not.toBeNull();
  expect(canvasWorkspaceBox).not.toBeNull();
  expect(agentSidebarBox).not.toBeNull();

  expect(assetSidebarBox!.y + assetSidebarBox!.height).toBeGreaterThan(viewport.height - 16);
  expect(canvasWorkspaceBox!.y + canvasWorkspaceBox!.height).toBeGreaterThan(viewport.height - 16);
  expect(agentSidebarBox!.y + agentSidebarBox!.height).toBeGreaterThan(viewport.height - 16);
});

test('can export project json', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('canvas-project.json');
});

test('rulers stay visible and react to selection and zoom changes', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSeedProject()]);

  await page.goto('/');
  await expect(page.getByRole('button', { name: '展开对话' })).toBeVisible();
  await page.getByRole('button', { name: /展开\s*素材管理/i }).click();
  await page.getByRole('button', { name: /Seed image/ }).click();
  await expect(page.getByText(/节点 1/)).toBeVisible();
  await expect(page.locator('.canvas-ruler-top')).toBeVisible();
  await expect(page.locator('.canvas-ruler-left')).toBeVisible();

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 80, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const draggedProject = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  expect(draggedProject.board.nodes[0].x).not.toBe(0);
  expect(draggedProject.board.nodes[0].y).not.toBe(0);
  const horizontalRange = page.locator('.canvas-ruler-range-x');
  const verticalRange = page.locator('.canvas-ruler-range-y');
  await expect(horizontalRange).toBeVisible();
  await expect(verticalRange).toBeVisible();

  const topRuler = page.locator('.canvas-ruler-top');
  const horizontalRangeBeforeZoom = await horizontalRange.boundingBox();
  expect(horizontalRangeBeforeZoom).not.toBeNull();

  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);

  const zoomedProject = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  expect(zoomedProject.board.viewport.scale).toBeGreaterThan(1);
  await expect(topRuler).toBeVisible();
  const horizontalRangeAfterZoom = await horizontalRange.boundingBox();
  expect(horizontalRangeAfterZoom).not.toBeNull();
  expect(horizontalRangeAfterZoom!.width).toBeGreaterThan(horizontalRangeBeforeZoom!.width);
});

test('dragged nodes snap to nearby alignment targets', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSnapSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.move(box.x + 390, box.y + 270);
  await page.mouse.down();
  await page.mouse.move(box.x + 588, box.y + 408, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  const rectNode = project.board.nodes.find((node: { id: string }) => node.id === 'node_rect_seed');

  expect(rectNode.x).toBe(520);
  expect(rectNode.y).toBe(360);
  await expect(page.locator('.canvas-ruler-range-x')).toBeVisible();
  await expect(page.locator('.canvas-ruler-range-y')).toBeVisible();
});

test('rotated nodes persist after reload and support undo redo', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createRotationSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.click(box.x + 72, box.y + 72);
  await page.mouse.move(box.x + 170, box.y + 36);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 145, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  let group = project.board.nodes.find((node: { id: string }) => node.id === 'group_rotation_seed');
  expect(group.rotation).toBeGreaterThan(1);

  await page.getByRole('button', { name: '撤销' }).click();
  await page.waitForTimeout(250);
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  group = project.board.nodes.find((node: { id: string }) => node.id === 'group_rotation_seed');
  expect(Math.abs(group.rotation)).toBeLessThan(0.01);

  await page.getByRole('button', { name: '重做' }).click();
  await page.waitForTimeout(250);
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  group = project.board.nodes.find((node: { id: string }) => node.id === 'group_rotation_seed');
  expect(group.rotation).toBeGreaterThan(1);

  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);
  await page.reload();
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  group = project.board.nodes.find((node: { id: string }) => node.id === 'group_rotation_seed');
  expect(group.rotation).toBeGreaterThan(1);
});

test('rotated groups can be dissolved while preserving child rotation and connector attachments', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createGroupedRotationSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.mouse.click(box.x + 72, box.y + 72);
  await page.mouse.move(box.x + 180, box.y + 36);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 150, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  const group = project.board.nodes.find((node: { id: string }) => node.id === 'group_seed');
  expect(group.rotation).toBeGreaterThan(1);
  const connectorBefore = project.board.nodes.find((node: { id: string }) => node.id === 'connector_seed');
  expect(connectorBefore.start).toEqual({ kind: 'attached', nodeId: 'node_rect_child', anchor: 'east' });

  await page.getByRole('button', { name: '拆分组' }).click();
  await page.waitForTimeout(300);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  expect(project.board.nodes.some((node: { id: string }) => node.id === 'group_seed')).toBe(false);
  const child = project.board.nodes.find((node: { id: string }) => node.id === 'node_rect_child');
  expect(child).toBeTruthy();
  expect(child.rotation).toBeGreaterThan(1);
  const connectorAfter = project.board.nodes.find((node: { id: string }) => node.id === 'connector_seed');
  expect(connectorAfter.start).toEqual({ kind: 'attached', nodeId: 'node_rect_child', anchor: 'east' });
});

test('connector tool creates anchored connectors, supports reattachment, and persists after reload', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createConnectorSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '连线' }).click();
  await page.mouse.move(box.x + 180, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 110, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  let connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector).toBeTruthy();
  expect(connector.start).toEqual({ kind: 'attached', nodeId: 'node_rect_a', anchor: 'east' });
  expect(connector.end).toEqual({ kind: 'attached', nodeId: 'node_rect_b', anchor: 'west' });

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(box.x + 250, box.y + 100);
  await page.mouse.move(box.x + 320, box.y + 110);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 290, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.end).toEqual({ kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' });

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.move(box.x + 110, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.start).toEqual({ kind: 'attached', nodeId: 'node_rect_a', anchor: 'east' });

  await page.reload();
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector).toBeTruthy();
  expect(connector.end).toEqual({ kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' });
});

test('connector anchors appear only for the proximate node and active group hides external targets', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createConnectorSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const anchors = page.locator('.canvas-anchor');
  const activeAnchors = page.locator('.canvas-anchor-active');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '连线' }).click();
  await expect(anchors).toHaveCount(0);

  await page.mouse.move(box.x + 100, box.y + 90);
  await expect(anchors).toHaveCount(4);
  await expect(activeAnchors).toHaveCount(0);

  await page.mouse.move(box.x + 180, box.y + 90);
  await expect(anchors).toHaveCount(4);
  await expect(activeAnchors).toHaveCount(1);

  await page.mouse.move(box.x + 520, box.y + 360);
  await expect(anchors).toHaveCount(0);

  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createGroupedRotationSeedProject()]);
  await page.reload();

  const groupedCanvas = page.locator('canvas');
  const groupedBox = await groupedCanvas.boundingBox();
  expect(groupedBox).not.toBeNull();

  if (!groupedBox) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(groupedBox.x + 120, groupedBox.y + 120);
  await page.getByRole('button', { name: '进入' }).click();
  await page.waitForTimeout(250);

  await page.getByRole('button', { name: '连线' }).click();
  await page.mouse.move(groupedBox.x + 150, groupedBox.y + 129);
  await expect(page.locator('.canvas-anchor')).toHaveCount(4);

  await page.mouse.move(groupedBox.x + 204, groupedBox.y + 129);
  await page.mouse.down();
  await page.mouse.move(groupedBox.x + 360, groupedBox.y + 160, { steps: 10 });
  await expect(page.locator('.canvas-anchor')).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(250);

  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  expect(project.board.nodes.filter((node: { type: string }) => node.type === 'connector')).toHaveLength(1);
});

test('polyline connector mode exposes bend handles, supports reattachment, and restores after reload', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createConnectorSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '连线' }).click();
  await page.getByRole('button', { name: '折线' }).click();
  await page.mouse.move(box.x + 180, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 110, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  let connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector).toBeTruthy();
  expect(connector.pathMode).toBe('polyline');
  expect(connector.waypoints).toHaveLength(1);
  expect(connector.waypoints[0]).toEqual({ x: 320, y: 90 });

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(box.x + 250, box.y + 90);
  const waypointHandle = page.locator('.canvas-connector-handle-waypoint').first();
  await expect(waypointHandle).toHaveCount(0);

  await page.mouse.move(box.x + 320, box.y + 110);
  await page.mouse.down();
  await expect(waypointHandle).toBeVisible();
  await page.mouse.move(box.x + 320, box.y + 290, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.end).toEqual({ kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' });
  expect(connector.waypoints[0]).toEqual({ x: 320, y: 90 });

  await page.reload();
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.pathMode).toBe('polyline');
  expect(connector.waypoints[0]).toEqual({ x: 320, y: 90 });
  expect(connector.end).toEqual({ kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' });
});

test('curve connector mode creates curved connectors, supports undo redo, and restores after reload', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createConnectorSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '连线' }).click();
  await page.getByRole('button', { name: '曲线' }).click();
  await page.mouse.move(box.x + 180, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 110, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((storageKey) => {
    const project = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return project.board?.nodes?.some((node: { type: string; pathMode?: string }) => node.type === 'connector' && node.pathMode === 'curve');
  }, STORAGE_KEY);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  let connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector).toBeTruthy();
  expect(connector.pathMode).toBe('curve');
  expect(connector.curveControl).toBeTruthy();

  await page.getByRole('button', { name: '撤销' }).click();
  await page.waitForFunction((storageKey) => {
    const project = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return !project.board?.nodes?.some((node: { type: string }) => node.type === 'connector');
  }, STORAGE_KEY);

  await page.getByRole('button', { name: '重做' }).click();
  await page.waitForFunction((storageKey) => {
    const project = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return project.board?.nodes?.some((node: { type: string; pathMode?: string }) => node.type === 'connector' && node.pathMode === 'curve');
  }, STORAGE_KEY);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.pathMode).toBe('curve');
  expect(connector.curveControl).toBeTruthy();

  await page.reload();
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  connector = project.board.nodes.find((node: { type: string }) => node.type === 'connector');
  expect(connector.pathMode).toBe('curve');
  expect(connector.curveControl).toBeTruthy();
});

test('hover and selected chrome stay lightweight during hover and connector selection', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSelectionChromeSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  const videoOverlay = page.locator('.video-overlay-item').first();
  await page.mouse.move(box.x + 320, box.y + 120);
  await expect(videoOverlay).toHaveClass(/video-overlay-item-hovered/);

  await page.mouse.click(box.x + 320, box.y + 120);
  await expect(videoOverlay).toHaveClass(/video-overlay-item-selected/);
  await expect(page.getByLabel('选中对象工具栏')).toBeVisible();

  await page.getByRole('button', { name: '连线' }).click();
  await page.mouse.move(box.x + 220, box.y + 115);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 145, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(box.x + 250, box.y + 118);
  await expect(page.locator('.canvas-connector-handle')).toHaveCount(0);
});

test('rect, freehand, text, and media nodes remain available after engine-backed dispatch', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createEngineSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.move(box.x + 200, box.y + 235);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);

  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  const nodeTypes = project.board.nodes.map((node: { type: string }) => node.type);

  expect(nodeTypes).toEqual(expect.arrayContaining(['rect', 'freehand', 'text', 'image']));
  expect(project.board.nodes).toHaveLength(4);
  expect(project.board.nodes.find((node: { id: string }) => node.id === 'node_image_seed').x).toBe(120);
});

test('groups can wrap content, enter editing context, and persist child geometry after reload', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createEngineSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(box.x + 110, box.y + 90);
  const groupSelectionButton = page.getByRole('button', { name: '成组', exact: true });
  await expect(groupSelectionButton).toBeVisible();
  await groupSelectionButton.click();
  await page.waitForTimeout(250);

  let project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  let group = project.board.nodes.find((node: { type: string }) => node.type === 'group');
  expect(group).toBeTruthy();
  expect(group.children).toHaveLength(1);
  expect(group.children[0].id).toBe('node_rect_seed');

  await expect(page.getByRole('button', { name: '进入' })).toBeVisible();
  await page.getByRole('button', { name: '进入' }).click();
  await expect(page.getByText('正在编辑成组')).toBeVisible();
  await page.waitForTimeout(250);

  await page.mouse.move(box.x + 110, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 130, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  group = project.board.nodes.find((node: { type: string }) => node.type === 'group');
  expect(group.children[0].x).toBeGreaterThan(24);
  expect(group.x).toBeLessThan(group.children[0].x + group.x);

  await page.getByRole('button', { name: '退出成组' }).click();
  await expect(page.getByText('正在编辑成组')).toHaveCount(0);

  await page.reload();
  project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  group = project.board.nodes.find((node: { type: string }) => node.type === 'group');
  expect(group).toBeTruthy();
  expect(group.children[0].id).toBe('node_rect_seed');
  expect(group.children[0].x).toBeGreaterThan(24);
});

test('can multi-select top-level nodes and group them in one action', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createEngineSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.click(box.x + 110, box.y + 90);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 450, box.y + 90);
  await page.keyboard.up('Shift');

  const groupSelectionButton = page.getByRole('button', { name: '成组', exact: true });
  await expect(groupSelectionButton).toBeVisible();
  await groupSelectionButton.click();
  await page.waitForTimeout(250);

  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('infinite-canvas:v2') ?? '{}'));
  const group = project.board.nodes.find((node: { type: string }) => node.type === 'group');
  expect(group).toBeTruthy();
  expect(group.children).toHaveLength(2);
  expect(group.children.map((child: { id: string }) => child.id)).toEqual(['node_rect_seed', 'node_text_seed']);
});

test('marquee selection can select multiple top-level nodes', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    if (window.sessionStorage.getItem('__seeded_project__') === 'true') {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createEngineSeedProject()]);

  await page.goto('/');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  await page.getByRole('button', { name: '选择' }).click();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 560, box.y + 150, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByText('已选 3 项')).toBeVisible();
});

test('voice drafts stay editable until the user sends them from the sidebar composer', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '展开对话' }).click();

  await expect(page.getByRole('button', { name: '开始录音' })).toBeVisible();

  const chatInput = page.getByRole('textbox', { name: '发送给设计助理' });
  await chatInput.fill('保留霓虹配色\n把主标题改成更大胆一点');
  await expect(chatInput).toHaveValue('保留霓虹配色\n把主标题改成更大胆一点');

  await chatInput.fill('保留霓虹配色\n把主标题改成更大胆一点，并增加一行副标题');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByText('保留霓虹配色\n把主标题改成更大胆一点，并增加一行副标题')).toBeVisible();
  await expect(chatInput).toHaveValue('');
});

test('can create a canvas project, switch to another canvas, and switch back', async ({ page }) => {
  const firstProjectId = '11111111-1111-4111-8111-111111111111';
  const secondProjectId = '22222222-2222-4222-8222-222222222222';
  const createdProjectId = '33333333-3333-4333-8333-333333333333';
  const remoteProjects = new Map([
    [firstProjectId, { title: '当前画布', project: createEmptyChatSeedProject() }],
    [secondProjectId, { title: '第二画布', project: createSeedProject() }],
  ]);

  await page.route('**/projects', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projects: [...remoteProjects.entries()].map(([projectId, entry]) => ({
            projectId,
            title: entry.title,
            updatedAt: '2026-04-22T00:00:00.000Z',
          })),
        }),
      });
      return;
    }

    if (request.method() === 'POST') {
      const createdProject = createEmptyChatSeedProject();
      remoteProjects.set(createdProjectId, {
        title: '未命名画布',
        project: createdProject,
      });
      await route.fulfill({
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: createdProjectId,
          title: '未命名画布',
          project: createdProject,
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/projects/*', async (route) => {
    const request = route.request();
    const projectId = request.url().split('/projects/')[1];
    const entry = remoteProjects.get(projectId);

    if (!entry) {
      await route.fulfill({
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'not found' }),
      });
      return;
    }

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: entry.title,
          project: entry.project,
          updatedAt: '2026-04-22T00:00:00.000Z',
        }),
      });
      return;
    }

    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as { project: ReturnType<typeof createSeedProject> };
      remoteProjects.set(projectId, {
        ...entry,
        project: payload.project,
      });
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: entry.title,
          project: payload.project,
          updatedAt: '2026-04-22T00:00:00.000Z',
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/?projectId=${firstProjectId}`);

  await expect(page.locator('.header-title strong')).toHaveText('当前画布');

  await page.getByRole('button', { name: '新建画布' }).click();
  await expect(page.locator('.header-title strong')).toHaveText('未命名画布');

  await page.getByRole('button', { name: '展开对话' }).click();
  await page.getByRole('button', { name: '新对话' }).first().click();
  await expect(page.getByText('新会话')).toBeVisible();
  await page.waitForTimeout(700);

  await page.locator('.project-switcher').evaluate((node) => {
    (node as HTMLDetailsElement).open = true;
  });
  await page.locator('.project-switcher-item').filter({ hasText: '第二画布' }).first().evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await expect(page.locator('.header-title strong')).toHaveText('第二画布');

  await page.locator('.project-switcher').evaluate((node) => {
    (node as HTMLDetailsElement).open = true;
  });
  await page.locator('.project-switcher-item').filter({ hasText: '未命名画布' }).first().evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await expect(page.locator('.header-title strong')).toHaveText('未命名画布');
  await expect(page.getByText('新会话')).toBeVisible();
});
