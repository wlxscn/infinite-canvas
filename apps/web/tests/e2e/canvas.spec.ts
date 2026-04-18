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
  await expect(page.getByRole('complementary', { name: 'Agent chat sidebar' })).toBeVisible();
  await expect(page.getByRole('button', { name: '主会话 1 条消息' })).toBeVisible();
  await expect(page.getByText(/资产 1/).first()).toBeVisible();
  await expect(page.getByText('先定一张主画面')).toHaveCount(0);

  await page.getByRole('button', { name: /Seed image/ }).click();
  await expect(page.getByText(/节点 1/)).toBeVisible();
  await expect(page.getByText('保留这个方向')).toBeVisible();

  await page.getByRole('button', { name: '新建会话' }).first().click();
  await expect(sessionItems).toHaveCount(2);
  await expect(page.getByRole('button', { name: '新会话 0 条消息' })).toHaveCount(1);
  await expect(page.getByText(/暂无会话/)).toHaveCount(0);
  await sessionItems.first().click();
  await expect(page.getByText('保留这个方向')).toBeVisible();
  await page.waitForTimeout(250);

  await page.reload();

  await expect(page.getByText(/资产 1/).first()).toBeVisible();
  await expect(sessionItems).toHaveCount(2);
  await expect(page.getByText('保留这个方向')).toBeVisible();
});

test('asset sidebar can collapse and expand without hiding the canvas workspace', async ({ page }) => {
  await page.addInitScript(([storageKey, project]) => {
    window.localStorage.setItem(storageKey, JSON.stringify(project));
    window.sessionStorage.setItem('__seeded_project__', 'true');
  }, [STORAGE_KEY, createSeedProject()]);

  await page.goto('/');

  await expect(page.getByRole('complementary', { name: '素材管理侧栏' })).toBeVisible();
  await page.getByRole('button', { name: '收起素材栏' }).click();
  await expect(page.getByRole('button', { name: /展开/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: /展开/i }).click();
  await expect(page.getByRole('button', { name: '导入参考图' })).toBeVisible();
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
  await expect(page.getByPlaceholder('例如：生成一张极简科技海报，或把当前标题改得更大胆')).toBeVisible();
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

test('voice drafts stay editable until the user sends them from the sidebar composer', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '开始录音' })).toBeVisible();

  const chatInput = page.getByRole('textbox', { name: '发送给设计助理' });
  await chatInput.fill('保留霓虹配色\n把主标题改成更大胆一点');
  await expect(page.getByText('暂无会话')).toBeVisible();

  await chatInput.fill('保留霓虹配色\n把主标题改成更大胆一点，并增加一行副标题');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByText('保留霓虹配色\n把主标题改成更大胆一点，并增加一行副标题')).toBeVisible();
  await expect(page.getByText('暂无会话')).toHaveCount(0);
});
