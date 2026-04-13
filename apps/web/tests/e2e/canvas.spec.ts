import { expect, test } from '@playwright/test';

test('can generate an asset, chat with the assistant, and persist the sidebar after reload', async ({ page }) => {
  const userMessages = page.locator('.chat-message-user p');
  const sessionItems = page.locator('.agent-session-item');

  await page.goto('/');

  await expect(page.getByRole('complementary', { name: 'Agent chat sidebar' })).toBeVisible();
  await expect(page.getByText(/暂无会话/)).toBeVisible();
  await page.getByRole('button', { name: '新建会话' }).first().click();
  await expect(page.getByRole('button', { name: '新会话 0 条消息' })).toBeVisible();

  await page.getByRole('button', { name: '生成首版画面' }).click();
  await expect(page.getByText('已生成')).toBeVisible();

  await page.getByRole('button', { name: /Generated/i }).click();
  await expect(page.getByText(/节点 1/)).toBeVisible();

  await page.getByLabel('发送给设计助理').fill('给我一个标题');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(userMessages.filter({ hasText: '给我一个标题' })).toHaveCount(1);
  await expect(page.locator('.chat-message-assistant')).toHaveCount(2);

  await page.getByRole('button', { name: '添加宣传文字' }).last().click();
  await expect(userMessages.filter({ hasText: '请帮我添加宣传文字' })).toHaveCount(1);

  await page.getByRole('button', { name: '新建会话' }).first().click();
  await expect(sessionItems).toHaveCount(2);
  await expect(page.getByRole('button', { name: '新会话 0 条消息' })).toHaveCount(1);
  await expect(page.getByText(/暂无会话/)).toHaveCount(0);
  await expect(userMessages.filter({ hasText: '给我一个标题' })).toHaveCount(0);
  await sessionItems.first().click();
  await expect(userMessages.filter({ hasText: '给我一个标题' })).toHaveCount(1);

  await page.reload();

  await expect(page.getByText(/资产 1/).first()).toBeVisible();
  await expect(sessionItems).toHaveCount(2);
  await expect(userMessages.filter({ hasText: '给我一个标题' })).toHaveCount(1);
  await expect(page.locator('.chat-message-assistant').first()).toBeVisible();
});

test('can export project json', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('canvas-project.json');
});
