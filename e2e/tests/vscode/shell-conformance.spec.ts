import { test, type Page } from '@playwright/test';
import {
  registerShellConformance,
  vsCodeStubSearch,
  type ShellSkip,
} from '@miragon/modeler-shell/testing';
import { WEBVIEW_THEMES } from '../../../apps/vscode/src/themes.js';
import { labelEditorHooks } from '../support/label-editor.js';
import { countOf, postedMessages } from './support/webview.js';

/**
 * The shell's conformance kit against the real VS Code webview (main.ts inside the VS Code stub):
 * geometry at three sizes, ARIA and keyboard models, chrome keys and select all that never reach
 * VS Code while undo and redo do, keyboard creation from the palette, a label being typed across
 * the shell's zoom, fit and refit, the read-only lock of an invalid file, the appearance VS Code
 * requests (a light-only diagram stays light, high contrast passes) and a clean teardown. Value
 * chains have neither a legend nor an inspector, so the harness declares them absent and the kit
 * asserts they never show. The menu has no File or Model action either (`canvasMenuAction`): VS Code
 * owns the file commands, and no document setting is edited from the menu. Any other skip fails.
 */
const describeSkips = (skips: readonly ShellSkip[]): string =>
  skips.map((skip) => `${skip.hook}: ${skip.reason}`).join('; ');

/** What a half-typed edit in the text editor beside the diagram leaves in the document. */
const INVALID_DOCUMENT = '{\n  "connections": [\n    {\n      "connectionType": "seq';

test.describe('VS Code webview: shell conformance', () => {
  test.describe.configure({ timeout: 60_000 });

  registerShellConformance<Page>(
    {
      host: 'ide',
      themes: WEBVIEW_THEMES,
      async open(page, { size, requested }) {
        await page.setViewportSize(size);
        await page.goto(`/webview-test.html?${vsCodeStubSearch(requested)}`);
        await page.waitForFunction(() => window.webviewReady === true);
      },
      async destroy(page) {
        await page.evaluate(() => {
          window.connection?.destroy();
          window.modeler?.destroy();
          window.shell?.destroy();
        });
      },
      absent: ['legend', 'inspector', 'canvasMenuAction'],
      // A commit shows as an edit message to the extension host, which writes the document.
      labelEditor: labelEditorHooks(
        async (page) => `${countOf(await postedMessages(page), 'edit')} edits`,
      ),
      show: {
        // The way the extension host reports diagnostics: a `problems` message.
        async problems(page) {
          await page.evaluate(() =>
            window.postMessage({ type: 'problems', count: 2, errors: 1 }, '*'),
          );
          await page.waitForFunction(
            () => document.querySelector<HTMLElement>('[data-chrome="problems"]')?.hidden === false,
          );
        },
        async status(page) {
          await page.evaluate(() => {
            const shell = window.shell!;
            shell.setStatus({
              severity: 'danger',
              text: shell.messages.invalidFile('value chain diagram'),
            });
          });
        },
        // The invalid-file state the way the extension host causes it: an update that does not parse.
        async invalid(page) {
          await page.evaluate(
            (text) => window.postMessage({ type: 'update', text }, '*'),
            INVALID_DOCUMENT,
          );
        },
      },
    },
    test,
    {
      onSkip(caseName, skips) {
        throw new Error(`shell conformance "${caseName}" skipped: ${describeSkips(skips)}`);
      },
    },
  );
});
