import { expect, test } from '@playwright/test';
import { exportDocument, fileInput, openApp, openExample, toast } from './support/webapp.js';

test('opening a blank .vc file shows an empty diagram instead of an error', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });
  await openApp(page);
  await openExample(page);

  await fileInput(page).setInputFiles({
    name: 'blank.vc',
    mimeType: '',
    buffer: Buffer.from('\n'),
  });

  await expect(page.locator('.djs-shape[data-element-id]')).toHaveCount(0);
  expect((await exportDocument(page)).meta.name).toBe('New value chain');
  await expect(toast(page, 'Diagram replaced')).toBeVisible();
  await expect(page.locator('[data-chrome="toasts"] [data-status="danger"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});
