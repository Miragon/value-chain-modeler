import { test, type Page } from '@playwright/test';
import { registerShellConformance, type ShellSkip } from '@miragon/modeler-shell/testing';
import { EXAMPLE_DOCUMENT } from '../../apps/webapp/src/example.js';
import { THEMES } from '../../apps/webapp/src/themes.js';
import { linkTo, waitForApp } from './support/webapp.js';

/**
 * The shell's conformance kit against the real web app (the web host of guide §5.2): geometry at
 * three sizes with the primary action, the legal line and the raised zoom row, ARIA and keyboard
 * models, keyboard creation from the palette, the light-only mode under any system setting, the
 * start screen, toasts, the problems list, the drop zone and a clean teardown. The web app has
 * neither a legend nor an inspector, and no invalid-file state (a file that is no diagram is
 * refused before the import and leaves the canvas as it was), so the harness declares them absent;
 * any skip fails the suite.
 */
const describeSkips = (skips: readonly ShellSkip[]): string =>
  skips.map((skip) => `${skip.hook}: ${skip.reason}`).join('; ');

/** Pages that start every visit without the autosaved diagram of an earlier one. */
const freshPages = new WeakSet<Page>();

test.describe('web app: shell conformance', () => {
  test.describe.configure({ timeout: 60_000 });

  registerShellConformance<Page>(
    {
      host: 'web',
      themes: THEMES,
      // The kit emulates the system's colour scheme and contrast before every open.
      async open(page, { size }) {
        if (!freshPages.has(page)) {
          freshPages.add(page);
          await page.addInitScript(() => {
            try {
              localStorage.clear();
            } catch {
              // A blocked storage holds no diagram either.
            }
          });
        }
        await page.setViewportSize(size);
        await page.goto(await linkTo(EXAMPLE_DOCUMENT));
        await waitForApp(page);
      },
      async destroy(page) {
        await page.evaluate(() => window.__valueChainApp?.destroy());
      },
      // Import warnings name connections the import skipped, never an element on the canvas, so
      // no row of the problems list selects.
      absent: ['legend', 'inspector', 'invalid', 'problemSelection'],
      show: {
        // The rows the app reports after an import with warnings; a document that validates never
        // has any, so the hook hands the pill two the way reportWarnings does.
        async problems(page) {
          await page.evaluate(() =>
            window.__valueChainApp!.shell.setProblems({
              count: 2,
              errors: 0,
              items: [
                {
                  severity: 'warning',
                  message: 'Skipped connection "seq-9": unresolved endpoint.',
                },
                {
                  severity: 'warning',
                  message: 'Skipped connection "hier-9": unresolved endpoint.',
                },
              ],
            }),
          );
          await page.waitForFunction(
            () => document.querySelector<HTMLElement>('[data-chrome="problems"]')?.hidden === false,
          );
        },
        async status(page) {
          await page.evaluate(() => {
            const shell = window.__valueChainApp!.shell;
            shell.setStatus({
              severity: 'danger',
              text: shell.messages.invalidFile('value chain diagram'),
            });
          });
        },
        // A fresh visit: the page without a diagram in its link or in the storage.
        async emptyState(page) {
          await page.goto('/');
          await waitForApp(page);
        },
        async toast(page, { status, text, actionLabel }) {
          await page.evaluate(
            ({ status, text, actionLabel }) => {
              window.__valueChainApp?.shell.toast({
                status,
                text,
                ...(actionLabel ? { action: { label: actionLabel, onSelect() {} } } : {}),
              });
            },
            { status, text, actionLabel },
          );
        },
      },
      drop: {
        accepted: {
          name: 'porter.vc.json',
          type: 'application/json',
          text: EXAMPLE_DOCUMENT,
        },
        // A picture is refused already while it is dragged and, dropped all the same, opens nothing.
        rejected: { name: 'map.png', type: 'image/png', text: 'x' },
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
