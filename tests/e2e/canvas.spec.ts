import { expect, test } from '@playwright/test';

test('can draw a rectangle and persist after reload', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '矩形' }).click();
  const canvas = page.locator('canvas');

  await canvas.click({ position: { x: 200, y: 200 } });
  await page.mouse.down();
  await page.mouse.move(320, 280);
  await page.mouse.up();

  await page.reload();
  await expect(page.getByText(/图元: 1/)).toBeVisible();
});
