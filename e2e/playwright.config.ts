import { defineConfig, devices } from '@playwright/test';

// Ports are overridable via E2E_PORT and E2E_WEBVIEW_PORT so parallel runs (e.g. several
// workspaces) don't collide.
const WEBAPP_PORT = process.env.E2E_PORT ?? '5181';
const WEBAPP_URL = `http://localhost:${WEBAPP_PORT}`;
const WEBVIEW_PORT = process.env.E2E_WEBVIEW_PORT ?? '5191';
const WEBVIEW_URL = `http://127.0.0.1:${WEBVIEW_PORT}`;

/**
 * Two projects, one per host:
 *  - `webapp`: @miragon/value-chain-webapp. Its dev server resolves @miragon/value-chain-* via Vite
 *    source aliases (apps/webapp/vite.config.ts), so no package build is required. `cwd: '..'`
 *    runs the command from the repo root so the npm workspace resolves.
 *  - `vscode-webview`: the VS Code webview (apps/vscode/src/webview/main.ts) inside the shell's
 *    VS Code stub, served by its own Vite test page (webview/), also from the package sources.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serialize on CI for determinism; omit locally so Playwright auto-picks worker count.
  // (Spread instead of `workers: undefined` — exactOptionalPropertyTypes forbids the explicit undefined.)
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'webapp',
      testIgnore: '**/vscode/**',
      use: { ...devices['Desktop Chrome'], baseURL: WEBAPP_URL },
    },
    {
      name: 'vscode-webview',
      testMatch: '**/vscode/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: WEBVIEW_URL },
    },
  ],
  webServer: [
    {
      command: `npm run dev -w apps/webapp -- --port ${WEBAPP_PORT} --strictPort`,
      cwd: '..',
      url: WEBAPP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'npm run dev:webview',
      url: `${WEBVIEW_URL}/webview-test.html`,
      env: { E2E_WEBVIEW_PORT: WEBVIEW_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
