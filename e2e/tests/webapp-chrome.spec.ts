import { expect, test, type Page } from '@playwright/test';
import { EXAMPLE_DOCUMENT } from '../../apps/webapp/src/example.js';
import {
  exportDocument,
  exportText,
  fileInput,
  linkTo,
  openApp,
  openExample,
  openMenu,
  readDownload,
  startScreen,
  toast,
} from './support/webapp.js';

/**
 * The web app's side of the shell's web chrome: what it hands the shell (menu groups, primary
 * action, legal links, start screen, drop zone) and its own handlers behind them (share link,
 * autosave, replace with undo, open, drop, exports, app keys). What the shell guarantees itself
 * runs in webapp-shell-conformance.spec.ts.
 */

const ROUND_TRIP_DOCUMENT = JSON.stringify({
  schemaVersion: 1,
  meta: { name: 'Round Trip' },
  elements: [
    {
      id: 'a',
      elementType: 'step',
      name: 'A',
      bounds: { x: 40, y: 80, width: 160, height: 60 },
    },
    {
      id: 'b',
      elementType: 'step',
      name: 'B',
      bounds: { x: 280, y: 80, width: 160, height: 60 },
    },
  ],
  connections: [
    {
      id: 'c',
      connectionType: 'sequence',
      source: 'a',
      target: 'b',
      waypoints: [
        { x: 200, y: 110 },
        { x: 280, y: 110 },
      ],
    },
  ],
});

async function menuLayout(page: Page): Promise<Array<string | null>> {
  const dropdown = await openMenu(page);
  return dropdown.evaluate((menu) =>
    [...menu.children].map((child) =>
      child.getAttribute('role') === 'separator' ? '|' : child.getAttribute('data-menu-id'),
    ),
  );
}

/** A file drag and drop on the page, as the browser delivers one (the drop zone listens on window). */
async function dropFile(page: Page, name: string, type: string, text: string): Promise<void> {
  await page.evaluate(
    ({ name, type, text }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], name, { type }));
      for (const eventType of ['dragenter', 'dragover', 'drop']) {
        document.body.dispatchEvent(
          new DragEvent(eventType, { dataTransfer: transfer, bubbles: true, cancelable: true }),
        );
      }
    },
    { name, type, text },
  );
}

/** Creates a step from the palette by keyboard, as the shell's palette keys do. */
async function createStep(page: Page): Promise<void> {
  await page.locator('.djs-palette [data-action="create.step"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

test.describe('webapp: the shell web chrome and the app behind it', () => {
  test('a fresh visit shows the start screen, which hides the work chrome', async ({ page }) => {
    await openApp(page);

    await expect(startScreen(page)).toBeVisible();
    await expect(startScreen(page).getByRole('heading', { level: 1 })).toHaveText(
      'Value Chain Modeler',
    );
    await expect(startScreen(page)).toContainText('Or drop a .vc or .json file here');
    await expect(startScreen(page).locator('img')).toHaveAttribute(
      'src',
      '/miragon-komet-blau.svg',
    );
    await expect(page).toHaveTitle('Value Chain Modeler');
    for (const island of ['menu', 'primary', 'palette', 'zoom']) {
      await expect(page.locator(`[data-chrome="${island}"]`)).toBeHidden();
    }
    await expect(page.locator('[data-chrome="legal"]')).toBeVisible();

    await startScreen(page).getByRole('button', { name: 'New diagram' }).click();
    await expect(startScreen(page)).toBeHidden();
    for (const island of ['menu', 'primary', 'palette', 'zoom']) {
      await expect(page.locator(`[data-chrome="${island}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-chrome="zoom"] [data-zoom="actual"]')).toHaveText('100%');
    expect(new URL(page.url()).hash).toBe('');
  });

  test('Show example opens the Porter value chain and names the tab after it', async ({ page }) => {
    await openApp(page);
    await openExample(page);

    const document = await exportDocument(page);
    expect(document.meta.name).toBe('Porter Value Chain');
    expect(document.elements.map((element) => element.name)).toEqual(
      expect.arrayContaining(['Operations', 'Entwicklung']),
    );
    expect(await exportText(page)).toBe(EXAMPLE_DOCUMENT);
    await expect(page).toHaveTitle('Porter Value Chain · Value Chain Modeler');
    // The example fits, and never above 100 % (guide §5.9).
    await expect(page.locator('[data-chrome="zoom"] [data-zoom="actual"]')).toHaveText(/^\d+%$/);
    const zoom = await page.evaluate(() =>
      window.__valueChainApp!.modeler.diagram.get<{ zoom(): number }>('canvas').zoom(),
    );
    expect(zoom).toBeLessThanOrEqual(1);
  });

  test('the menu holds File, Export and Help; no Model, no Appearance, no Undo', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);

    expect(await menuLayout(page)).toEqual([
      'new-diagram',
      'open',
      'show-example',
      '|',
      'export-png',
      'export-svg',
      'export-json',
      '|',
      'keyboard-shortcuts',
    ]);
    const dropdown = page.locator('.cd-shell-menu[role="menu"]');
    await expect(dropdown.locator('[data-menu-id="open"]')).toHaveText(/Open…\s*(⌘|Ctrl\+)O/);
    await expect(dropdown.locator('[data-menu-id="export-json"]')).toHaveText(
      /Export as JSON\s*(⌘|Ctrl\+)S/,
    );
    await expect(dropdown.locator('[data-menu-group="model"]')).toHaveCount(0);
    await expect(dropdown.locator('[data-menu-group="appearance"]')).toHaveCount(0);
    await expect(dropdown.getByRole('menuitem', { name: /undo|redo/i })).toHaveCount(0);
  });

  test('the shortcuts dialog lists the File keys first', async ({ page }) => {
    await openApp(page);
    await openExample(page);
    await (await openMenu(page)).locator('[data-menu-id="keyboard-shortcuts"]').click();

    const dialog = page.locator('dialog.vc-shortcuts');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.vc-shortcuts-group-title')).toHaveText([
      'File',
      'View',
      'Edit',
      'Tools',
    ]);
    await expect(dialog.locator('table').first().locator('th')).toHaveText([
      'Open…',
      'Export as JSON',
    ]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-chrome="menu"]')).toBeFocused();
  });

  test('the legal line links Miragon and the repository', async ({ page }) => {
    await openApp(page);
    const legal = page.locator('[data-chrome="legal"]');
    await expect(legal.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Miragon/value-chain-modeler',
    );
    await expect(legal.getByRole('link', { name: 'Impressum' })).toHaveAttribute('lang', 'de');
  });

  test('the diagram survives a reload; an emptied one gives the start screen back', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);
    await createStep(page);
    const edited = await exportText(page);

    await page.reload();
    await page.waitForFunction(() => window.__valueChainApp?.ready === true);
    await expect(startScreen(page)).toBeHidden();
    expect(await exportText(page)).toBe(edited);

    await (await openMenu(page)).locator('[data-menu-id="new-diagram"]').click();
    await expect.poll(async () => (await exportDocument(page)).elements.length).toBe(0);
    await page.reload();
    await page.waitForFunction(() => window.__valueChainApp?.ready === true);
    await expect(startScreen(page)).toBeVisible();
  });

  test('an autosave that no longer reads gives the start screen and says so', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('value-chain-modeler.document', '{ "elements": '),
    );
    await openApp(page);

    await expect(startScreen(page)).toBeVisible();
    await expect(toast(page, "Couldn't restore the diagram of your last visit.")).toHaveAttribute(
      'data-status',
      'danger',
    );
  });

  test('an autosave or a link with an id the canvas cannot hold gives the start screen', async ({
    page,
  }) => {
    const refused = ROUND_TRIP_DOCUMENT.replaceAll('"b"', '"constructor"');
    await page.addInitScript(
      (text) => localStorage.setItem('value-chain-modeler.document', text),
      refused,
    );
    await openApp(page, await linkTo(refused));

    await expect(startScreen(page)).toBeVisible();
    await expect(toast(page, "Couldn't restore the diagram of your last visit.")).toBeVisible();
    await expect(toast(page, 'Check that you copied the whole link.')).toHaveAttribute(
      'data-status',
      'danger',
    );
  });

  test('a diagram the canvas refuses after all keeps the open one and says so', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);
    await page.evaluate(() => {
      window.__valueChainApp!.modeler.importText = () => Promise.reject(new Error('refused'));
    });

    await dropFile(page, 'round-trip.vc', '', ROUND_TRIP_DOCUMENT);

    await expect(toast(page, "Couldn't read “round-trip.vc”.")).toHaveAttribute(
      'data-status',
      'danger',
    );
    expect(await exportText(page)).toBe(EXAMPLE_DOCUMENT);
    await expect(toast(page, 'Diagram replaced')).toHaveCount(0);
    await expect(page).toHaveTitle('Porter Value Chain · Value Chain Modeler');
  });

  test('Share copies the link, shows it in the address bar until the next edit', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await openExample(page);

    await page.locator('[data-chrome="primary"]').click();

    await expect(toast(page, 'Link copied')).toHaveAttribute('data-status', 'success');
    await expect(page.locator('.cd-shell-live [role="status"]')).toHaveText('Link copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/#mz=[\w-]+$/);
    expect(copied).toBe(page.url());

    // Another browser opens the link as the same diagram.
    const shared = await (await context.browser()!.newContext()).newPage();
    await shared.goto(copied);
    await shared.waitForFunction(() => window.__valueChainApp?.ready === true);
    await expect(startScreen(shared)).toBeHidden();
    expect(await exportText(shared)).toBe(await exportText(page));
    await shared.context().close();

    // The link holds the shared state, so the first edit takes it out of the address bar.
    await createStep(page);
    await expect.poll(() => new URL(page.url()).hash).toBe('');
  });

  test('a refused copy points at the address bar', async ({ page }) => {
    await openApp(page);
    await openExample(page);
    await page.evaluate(() => {
      const refuse = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      Object.assign(navigator.clipboard, { write: refuse, writeText: refuse });
    });

    await page.locator('[data-chrome="primary"]').click();

    await expect(
      toast(page, "Couldn't copy the link. Copy it from the address bar instead."),
    ).toHaveAttribute('data-status', 'danger');
    expect(new URL(page.url()).hash).toMatch(/^#mz=/);
  });

  test('a link replaces the diagram this browser kept, which stays an Undo away', async ({
    page,
  }) => {
    await openApp(page, await linkTo(ROUND_TRIP_DOCUMENT));
    await expect(startScreen(page)).toBeHidden();
    const kept = await exportText(page);

    await page.goto('/');
    await page.waitForFunction(() => window.__valueChainApp?.ready === true);
    expect(await exportText(page)).toBe(kept);

    await page.goto(await linkTo(EXAMPLE_DOCUMENT));
    await page.waitForFunction(() => window.__valueChainApp?.ready === true);
    expect(await exportText(page)).toBe(EXAMPLE_DOCUMENT);
    const offer = toast(page, 'Diagram replaced');
    await offer.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => exportText(page)).toBe(kept);
    // The address bar no longer holds the diagram on the canvas.
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a link pasted into the open tab replaces the diagram', async ({ page }) => {
    await openApp(page);
    await openExample(page);

    await page.evaluate(
      (hash) => (location.hash = hash),
      (await linkTo(ROUND_TRIP_DOCUMENT)).slice(1),
    );

    await expect.poll(async () => (await exportDocument(page)).meta.name).toBe('Round Trip');
    await expect(toast(page, 'Diagram replaced')).toBeVisible();
    await expect(page).toHaveTitle('Round Trip · Value Chain Modeler');
  });

  test('a link cut off when it was copied shows a danger toast on the start screen', async ({
    page,
  }) => {
    await openApp(page, '/#mz=!!!not-a-diagram');

    await expect(startScreen(page)).toBeVisible();
    await expect(toast(page, 'Check that you copied the whole link.')).toHaveAttribute(
      'data-status',
      'danger',
    );
  });

  test('replacing a diagram offers Undo instead of asking first', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await openApp(page);
    await openExample(page);

    await (await openMenu(page)).locator('[data-menu-id="new-diagram"]').click();
    await expect.poll(async () => (await exportDocument(page)).elements.length).toBe(0);

    const offer = toast(page, 'Diagram replaced');
    await expect(offer).toHaveAttribute('data-status', 'info');
    await offer.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => exportText(page)).toBe(EXAMPLE_DOCUMENT);
    await expect(offer).toBeHidden();
    expect(dialogs).toEqual([]);
  });

  test('Cmd/Ctrl+Z takes a replaced diagram back while the canvas has nothing to undo', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);
    await (await openMenu(page)).locator('[data-menu-id="new-diagram"]').click();
    await expect(toast(page, 'Diagram replaced')).toBeVisible();

    await page.locator('.djs-container > svg').focus();
    await page.keyboard.press('ControlOrMeta+Z');

    await expect.poll(() => exportText(page)).toBe(EXAMPLE_DOCUMENT);
    await expect(toast(page, 'Diagram replaced')).toBeHidden();
  });

  test('an edit after a replacement withdraws the undo offer; undo is the canvas’s again', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);
    await (await openMenu(page)).locator('[data-menu-id="new-diagram"]').click();
    await expect(toast(page, 'Diagram replaced')).toBeVisible();

    await createStep(page);
    await expect(toast(page, 'Diagram replaced')).toBeHidden();
    expect((await exportDocument(page)).elements).toHaveLength(1);

    await page.locator('.djs-container > svg').focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect.poll(async () => (await exportDocument(page)).elements.length).toBe(0);
  });

  test('a file that is no diagram shows a danger toast and keeps the diagram', async ({ page }) => {
    await openApp(page);
    await openExample(page);

    await fileInput(page).setInputFiles({
      name: 'bad.vc.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ "elements": '),
    });

    await expect(
      toast(
        page,
        "Couldn't read “bad.vc.json”. Check that it contains a valid value chain diagram.",
      ),
    ).toHaveAttribute('data-status', 'danger');
    expect(await exportText(page)).toBe(EXAMPLE_DOCUMENT);
  });

  test('a .vc file dropped on the start screen opens', async ({ page }) => {
    await openApp(page);

    await dropFile(page, 'round-trip.vc', '', ROUND_TRIP_DOCUMENT);

    await expect(startScreen(page)).toBeHidden();
    await expect.poll(async () => (await exportDocument(page)).meta.name).toBe('Round Trip');
    await expect(page.locator('[data-chrome="palette"]')).toBeVisible();
  });

  test('the exports download under the diagram’s name and confirm with a toast', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);

    const expected: ReadonlyArray<[string, string]> = [
      ['export-png', 'porter-value-chain.png'],
      ['export-svg', 'porter-value-chain.svg'],
      ['export-json', 'porter-value-chain.vc.json'],
    ];
    for (const [id, fileName] of expected) {
      const dropdown = await openMenu(page);
      const download = page.waitForEvent('download');
      await dropdown.locator(`[data-menu-id="${id}"]`).click();
      expect((await download).suggestedFilename()).toBe(fileName);
      await expect(toast(page, `Exported ${fileName}.`)).toHaveAttribute('data-status', 'success');
    }
  });

  test('the JSON export holds the document and opens again as the same diagram', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);
    await createStep(page);
    const edited = await exportText(page);

    const download = page.waitForEvent('download');
    await (await openMenu(page)).locator('[data-menu-id="export-json"]').click();
    const json = await readDownload(download);
    expect(json).toBe(edited);

    await fileInput(page).setInputFiles({
      name: 'porter-value-chain.vc.json',
      mimeType: 'application/json',
      buffer: Buffer.from(json),
    });
    await expect(toast(page, 'Exported porter-value-chain.vc.json.')).toBeVisible();
    await expect.poll(() => exportText(page)).toBe(edited);
    // Nothing changed, so there is nothing to undo.
    await expect(toast(page, 'Diagram replaced')).toHaveCount(0);
  });

  test('the SVG export is the diagram without the chrome', async ({ page }) => {
    await openApp(page);
    await openExample(page);

    const download = page.waitForEvent('download');
    await (await openMenu(page)).locator('[data-menu-id="export-svg"]').click();
    const svg = await readDownload(download);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Operations');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('djs-palette');
    expect(svg).not.toContain('role="application"');
  });

  test('Cmd/Ctrl+O opens the file picker and Cmd/Ctrl+S exports the JSON document', async ({
    page,
  }) => {
    await openApp(page);
    await openExample(page);

    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('ControlOrMeta+O');
    expect((await chooser).isMultiple()).toBe(false);

    const download = page.waitForEvent('download');
    await page.keyboard.press('ControlOrMeta+S');
    expect((await download).suggestedFilename()).toBe('porter-value-chain.vc.json');
  });

  test('Cmd/Ctrl+S saves nothing on the start screen, and never reaches the browser', async ({
    page,
  }) => {
    await openApp(page);
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    const prevented = page.evaluate(
      () =>
        new Promise<boolean>((resolve) =>
          window.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 's') resolve(event.defaultPrevented);
          }),
        ),
    );

    await page.keyboard.press('ControlOrMeta+S');

    expect(await prevented).toBe(true);
    await page.waitForTimeout(300);
    expect(downloads).toEqual([]);
    await expect(page.locator('[data-chrome="toasts"] .cd-shell-toast')).toHaveCount(0);
    await expect(startScreen(page)).toBeVisible();
  });

  test('the start screen opens a file from its hint, without the hidden menu', async ({ page }) => {
    await openApp(page);
    const open = startScreen(page).getByRole('button', { name: 'Open a file…' });
    await expect(open).toHaveAttribute('aria-keyshortcuts', /^(Meta|Control)\+O$/);

    const chooser = page.waitForEvent('filechooser');
    await open.click();
    await (
      await chooser
    ).setFiles({
      name: 'porter.vc.json',
      mimeType: 'application/json',
      buffer: Buffer.from(EXAMPLE_DOCUMENT),
    });

    await expect(startScreen(page)).toBeHidden();
    await expect.poll(() => exportText(page)).toBe(EXAMPLE_DOCUMENT);
  });
});
