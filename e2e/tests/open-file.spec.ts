import { test, expect } from '@playwright/test';

test('opening a blank .vc file shows an empty diagram instead of an error', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await page.goto('/');
  await page.waitForFunction(() => '__vcModeler' in window);

  await page.locator('#btn-example').click();
  await expect(page.locator('#canvas .djs-shape').first()).toBeVisible();

  await page
    .locator('#file-input')
    .setInputFiles({ name: 'blank.vc', mimeType: '', buffer: Buffer.from('\n') });

  await expect(page.locator('#canvas .djs-shape')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});
