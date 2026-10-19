import { expect, test, type Locator, type Page } from '@playwright/test';
import { ICONS, type ShellIconName } from '@miragon/modeler-shell';
import { EMPTY_DOCUMENT, EXAMPLE_DOCUMENT } from '../../../apps/vscode/src/examples.js';
import {
  countOf,
  openWebview,
  postFromHost,
  postedMessages,
  waitForPosted,
} from './support/webview.js';

/**
 * The webview's side of the protocol with the extension host and the chrome it configures in the
 * shell: menu groups, palette names and keys, problems pill, empty-file hint, Command Palette
 * commands, the read-only lock of an invalid file and the keyboard shortcuts dialog. What the
 * shell guarantees itself is covered by shell-conformance.spec.ts.
 */

async function openMenu(page: Page): Promise<Locator> {
  await page.locator('[data-chrome="menu"]').click();
  const dropdown = page.locator('.cd-shell-menu[role="menu"]');
  await expect(dropdown).toBeVisible();
  return dropdown;
}

/** The icon of a menu entry as Lucide nodes, to compare with the shell's `ICONS`. */
function iconNodesOf(entry: Locator): Promise<Array<[string, Record<string, string>]>> {
  return entry.evaluate((element) =>
    [...(element.querySelector('.cd-shell-menu-item-icon svg')?.children ?? [])].map(
      (child): [string, Record<string, string>] => [
        child.tagName,
        Object.fromEntries(
          [...child.attributes].map((attribute) => [attribute.name, attribute.value]),
        ),
      ],
    ),
  );
}

function lucideNodes(name: ShellIconName): Array<[string, Record<string, string>]> {
  return ICONS[name].map(([tag, attributes]) => [tag, { ...attributes }]);
}

function shapeIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window
      .modeler!.diagram.get<{
        getAll(): Array<{ id: string; vcType?: string; waypoints?: unknown }>;
      }>('elementRegistry')
      .getAll()
      .filter((element) => element.vcType && !element.waypoints)
      .map((element) => element.id)
      .sort(),
  );
}

function selectedIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window
      .modeler!.diagram.get<{ get(): Array<{ id: string }> }>('selection')
      .get()
      .map((element) => element.id)
      .sort(),
  );
}

function zoom(page: Page): Promise<number> {
  return page.evaluate(() => window.modeler!.diagram.get<{ zoom(): number }>('canvas').zoom());
}

test.describe('VS Code webview: protocol and chrome', () => {
  test('posts ready exactly once and no edit for an import', async ({ page }) => {
    await openWebview(page);
    const messages = await postedMessages(page);
    expect(countOf(messages, 'ready')).toBe(1);
    expect(countOf(messages, 'edit')).toBe(0);
  });

  test('the menu holds Export (PNG before SVG) and Help, with the common icons', async ({
    page,
  }) => {
    await openWebview(page);
    const dropdown = await openMenu(page);

    const layout = await dropdown.evaluate((menu) =>
      [...menu.children].map((child) =>
        child.getAttribute('role') === 'separator' ? '|' : child.getAttribute('data-menu-id'),
      ),
    );
    expect(layout).toEqual(['export-png', 'export-svg', '|', 'keyboard-shortcuts']);

    const exportPng = dropdown.locator('[data-menu-id="export-png"]');
    const exportSvg = dropdown.locator('[data-menu-id="export-svg"]');
    const shortcuts = dropdown.locator('[data-menu-id="keyboard-shortcuts"]');
    await expect(exportPng).toHaveText('Export as PNG');
    await expect(exportSvg).toHaveText('Export as SVG');
    await expect(shortcuts).toHaveText('Keyboard shortcuts…');
    await expect(shortcuts).toHaveAttribute('aria-haspopup', 'dialog');
    expect(await iconNodesOf(exportPng)).toEqual(lucideNodes('file-image'));
    expect(await iconNodesOf(exportSvg)).toEqual(lucideNodes('file-code-corner'));
    expect(await iconNodesOf(shortcuts)).toEqual(lucideNodes('keyboard'));
  });

  test('the palette names its tools and keys, Lasso first', async ({ page }) => {
    await openWebview(page);
    const entries = page.locator('[data-chrome="palette"] .entry');
    const facts = await entries.evaluateAll((elements) =>
      elements.map((element) => [
        element.getAttribute('data-action'),
        element.getAttribute('aria-label'),
        element.getAttribute('aria-keyshortcuts'),
      ]),
    );
    expect(facts).toEqual([
      ['lasso-tool', 'Lasso', 'L'],
      ['hand-tool', 'Hand', 'H'],
      ['space-tool', 'Create or remove space', 'S'],
      ['global-connect-tool', 'Connect', 'C'],
      ['create.step', 'Step', null],
      ['create.org-unit', 'Organizational unit', null],
    ]);
  });

  test('Enter on Step creates one step in the free canvas, posts it and opens its label', async ({
    page,
  }) => {
    await openWebview(page, { diagram: 'empty' });
    await page.locator('[data-chrome="palette"] [data-action="create.step"]').focus();
    await page.keyboard.press('Enter');

    const edit = await waitForPosted(page, 'edit');
    const document = JSON.parse(edit['text'] as string) as {
      elements: Array<{ id: string; elementType: string }>;
    };
    expect(document.elements).toEqual([
      expect.objectContaining({ elementType: 'step', id: expect.stringMatching(/^step_/) }),
    ]);
    await expect(page.locator('.djs-direct-editing-parent')).toBeVisible();
    expect(await selectedIds(page)).toEqual([document.elements[0]!.id]);
  });

  test('a label typed on the canvas becomes one edit of the document', async ({ page }) => {
    await openWebview(page);
    await page.locator('.djs-shape[data-element-id="step-service"]').dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('After-sales');
    await page.keyboard.press('Enter');

    const edit = await waitForPosted(page, 'edit');
    expect(edit['text']).toContain('"name": "After-sales"');
    expect(countOf(await postedMessages(page), 'edit')).toBe(1);
  });

  test('undo on the canvas belongs to the VS Code document, not to the canvas', async ({
    page,
  }) => {
    await openWebview(page);
    const shape = page.locator('.djs-shape[data-element-id="step-service"]');
    await shape.click();
    await page.keyboard.press('Delete');
    await waitForPosted(page, 'edit');
    const editsBefore = countOf(await postedMessages(page), 'edit');
    expect(await shapeIds(page)).not.toContain('step-service');

    await page.locator('.cd-shell-canvas svg[role="application"]').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.waitForTimeout(300);

    expect(await shapeIds(page)).not.toContain('step-service');
    expect(countOf(await postedMessages(page), 'edit')).toBe(editsBefore);
  });

  test('Cmd/Ctrl+A on the canvas selects every element and never reaches VS Code', async ({
    page,
  }) => {
    await openWebview(page);
    await page.evaluate(() => {
      (window as unknown as { selectAllSeen: boolean[] }).selectAllSeen = [];
      window.addEventListener('keydown', (event) => {
        if (event.key === 'a') {
          (window as unknown as { selectAllSeen: boolean[] }).selectAllSeen.push(
            event.defaultPrevented,
          );
        }
      });
    });
    await page.locator('.cd-shell-canvas svg[role="application"]').focus();
    await page.keyboard.press('ControlOrMeta+a');

    expect(await selectedIds(page)).toHaveLength(15);
    expect(
      await page.evaluate(() => (window as unknown as { selectAllSeen: boolean[] }).selectAllSeen),
    ).toEqual([]);
  });

  test('an update of the same diagram in another layout keeps view and selection', async ({
    page,
  }) => {
    await openWebview(page);
    await page.locator('.djs-shape[data-element-id="step-testing"]').click();
    await page.locator('[data-zoom="in"]').click();
    const before = await page.evaluate(() => window.connection!.viewport.getViewbox());

    const reformatted = JSON.stringify(JSON.parse(EXAMPLE_DOCUMENT), null, 4).replace(
      /\n/g,
      '\r\n',
    );
    await postFromHost(page, { type: 'update', text: reformatted });
    await page.waitForTimeout(200);

    expect(await selectedIds(page)).toEqual(['step-testing']);
    expect(await page.evaluate(() => window.connection!.viewport.getViewbox())).toEqual(before);
  });

  test('an external change re-imports, keeping the view and the selection that still exists', async ({
    page,
  }) => {
    await openWebview(page);
    await page.locator('.djs-shape[data-element-id="step-testing"]').click();
    const before = await page.evaluate(() => window.connection!.viewport.getViewbox());

    const changed = EXAMPLE_DOCUMENT.replace('"name": "Testing"', '"name": "Quality"');
    await postFromHost(page, { type: 'update', text: changed });
    await expect(page.locator('.djs-shape[data-element-id="step-testing"]')).toContainText(
      'Quality',
    );

    expect(await selectedIds(page)).toEqual(['step-testing']);
    expect(await page.evaluate(() => window.connection!.viewport.getViewbox())).toEqual(before);
    expect(countOf(await postedMessages(page), 'edit')).toBe(0);
  });

  test('an empty file opens at 100% with the hint, and Insert example asks the host', async ({
    page,
  }) => {
    await openWebview(page, { diagram: 'empty' });
    expect(await zoom(page)).toBe(1);
    const hint = page.locator('.cd-shell-hint');
    await expect(hint).toBeVisible();

    await hint.getByRole('button', { name: 'Insert example' }).click();
    await waitForPosted(page, 'insertExample');

    // The host writes the example and sends it back as an update; the canvas fits it.
    await postFromHost(page, { type: 'update', text: EXAMPLE_DOCUMENT });
    await expect(page.locator('.djs-shape[data-element-id="step-operations"]')).toBeVisible();
    await expect(hint).toBeHidden();
  });

  test('a blank file opens as an empty diagram and is written only on the first edit', async ({
    page,
  }) => {
    await openWebview(page, { diagram: 'blank' });
    expect(await shapeIds(page)).toEqual([]);
    await expect(page.locator('.cd-shell-hint')).toBeVisible();
    expect(countOf(await postedMessages(page), 'edit')).toBe(0);
  });

  test('an invalid file locks the canvas with a status box until the text is valid again', async ({
    page,
  }) => {
    await openWebview(page);
    await postFromHost(page, { type: 'update', text: '{ "schemaVersion": 1, ' });
    const status = page.locator('[data-chrome="status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toContainText("This file isn't a valid value chain diagram right now.");
    await expect(page.locator('.cd-shell')).toHaveAttribute('data-readonly', '');

    // The last valid diagram stays, read-only: no context pad, no delete, no label editor.
    const shape = page.locator('.djs-shape[data-element-id="step-service"]');
    await shape.click();
    await expect(page.locator('.djs-context-pad .entry')).toHaveCount(0);
    await page.keyboard.press('Delete');
    await shape.dblclick();
    await expect(page.locator('.djs-direct-editing-parent')).toBeHidden();
    expect(await shapeIds(page)).toContain('step-service');
    expect(countOf(await postedMessages(page), 'edit')).toBe(0);

    await postFromHost(page, { type: 'update', text: EXAMPLE_DOCUMENT });
    await expect(status).toBeHidden();
    await expect(page.locator('.cd-shell')).not.toHaveAttribute('data-readonly', '');
  });

  test('an invalid file at the start shows no Insert example over its empty canvas', async ({
    page,
  }) => {
    await openWebview(page, { diagram: 'invalid' });
    await expect(page.locator('[data-chrome="status"]')).toBeVisible();
    await expect(page.locator('.cd-shell-hint')).toBeHidden();
  });

  test('the problems pill shows the host’s count and opens the Problems view', async ({ page }) => {
    await openWebview(page);
    const pill = page.locator('[data-chrome="problems"]');
    await expect(pill).toBeHidden();

    await postFromHost(page, { type: 'problems', count: 2, errors: 2 });
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute('aria-label', '2 problems, 2 errors');
    await pill.click();
    await waitForPosted(page, 'showProblems');

    await postFromHost(page, { type: 'problems', count: 0, errors: 0 });
    await expect(pill).toBeHidden();
  });

  test('the Command Palette commands run the menu’s handlers', async ({ page }) => {
    await openWebview(page);
    await page.locator('[data-zoom="in"]').click();
    await page.locator('[data-zoom="in"]').click();
    const zoomed = await zoom(page);

    await postFromHost(page, { type: 'command', name: 'fitView' });
    await expect.poll(() => zoom(page)).toBeLessThan(zoomed);

    await postFromHost(page, { type: 'command', name: 'exportSvg' });
    const svg = await waitForPosted(page, 'export');
    expect(svg).toMatchObject({ format: 'svg' });
    expect(svg['data']).toContain('Operations');
    expect(svg['data']).not.toMatch(/ (tabindex|role|aria-label)=/);

    await postFromHost(page, { type: 'command', name: 'exportPng' });
    await expect
      .poll(async () =>
        (await postedMessages(page)).some(
          (message) => message.type === 'export' && message['format'] === 'png',
        ),
      )
      .toBe(true);
  });

  test('the keyboard shortcuts dialog opens from Help and closes on Escape', async ({ page }) => {
    await openWebview(page);
    const dropdown = await openMenu(page);
    await dropdown.locator('[data-menu-id="keyboard-shortcuts"]').click();

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h4')).toHaveText(['View', 'Edit', 'Tools']);
    await expect(dialog.getByRole('row', { name: /Fit to view/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-chrome="menu"]')).toBeFocused();
  });

  test('the shortcuts dialog draws its high-contrast edge under VS Code high contrast', async ({
    page,
  }) => {
    await openWebview(page, { requested: { theme: 'dark', kontrast: 'hoch' } });
    await expect(page.locator('html')).toHaveAttribute('data-cd-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-cd-kontrast', 'hoch');
    await page.locator('[data-chrome="menu"]').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    const dialog = page.locator('dialog.vc-shortcuts');
    await expect(dialog).toBeVisible();
    const painted = await dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      const kontur = getComputedStyle(document.documentElement)
        .getPropertyValue('--cd-ui-kontur')
        .trim();
      const probe = document.createElement('div');
      probe.style.color = kontur;
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { border: style.borderTopColor, expected, shadow: style.boxShadow };
    });
    expect(painted.border).toBe(painted.expected);
    expect(painted.shadow).toBe('none');
  });

  test('a dark VS Code theme keeps the diagram and its chrome light', async ({ page }) => {
    await openWebview(page, { requested: { theme: 'dark' } });
    await expect(page.locator('html')).toHaveAttribute('data-cd-theme', 'light');
    const paper = await page.evaluate(
      () => getComputedStyle(document.querySelector('.cd-shell-canvas')!).backgroundColor,
    );
    expect(paper).toBe('rgb(249, 247, 247)');

    await page.evaluate(() => window.__modelerShellVsCodeStub!.setColorThemeKind(2));
    await page.waitForTimeout(100);
    await expect(page.locator('html')).toHaveAttribute('data-cd-theme', 'light');
  });

  test('stores the view in the webview state, for a reload of the window', async ({ page }) => {
    await openWebview(page);
    await page.locator('[data-zoom="in"]').click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window.__modelerShellVsCodeStub?.state() as {
                modelerShell?: { view?: { userMoved: boolean } };
              }
            )?.modelerShell?.view?.userMoved,
        ),
      )
      .toBe(true);
  });
});

test.describe('VS Code webview: empty documents', () => {
  test('the empty diagram of New Empty Value Chain Diagram imports without edits', async ({
    page,
  }) => {
    await openWebview(page, { diagram: 'empty' });
    expect(await page.evaluate(() => window.modeler!.exportText())).toBe(EMPTY_DOCUMENT);
    expect(countOf(await postedMessages(page), 'edit')).toBe(0);
  });
});
