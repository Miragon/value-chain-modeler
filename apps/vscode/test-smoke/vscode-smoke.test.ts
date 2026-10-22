import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { formatVsCodeSmoke, runVsCodeSmoke } from '@miragon/modeler-shell/testing/vscode-electron';
import { parseDocumentJSON } from '@miragon/value-chain-schema-model';
import { createVSIX } from '@vscode/vsce';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { WEBVIEW_THEMES } from '../src/themes.js';

const extensionRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

let packageDirectory: string;

// VS Code runs the extension unpacked from the VSIX, without node_modules: a module the bundle
// requires but does not contain fails to activate there, while the workspace folder would find it.
beforeAll(async () => {
  packageDirectory = await mkdtemp(join(tmpdir(), 'value-chain-vsix-'));
  const vsix = join(packageDirectory, 'value-chain-modeler.vsix');
  await createVSIX({ cwd: extensionRoot, dependencies: false, packagePath: vsix });
  await promisify(execFile)('unzip', ['-q', vsix, 'extension/*', '-d', packageDirectory]);
}, 120_000);

afterAll(async () => {
  if (packageDirectory) await rm(packageDirectory, { recursive: true, force: true });
});

it(
  'opens, edits, saves, undoes and themes a value chain in a real VS Code',
  { timeout: 600_000 },
  async () => {
    const result = await runVsCodeSmoke({
      extensionPath: join(packageDirectory, 'extension'),
      fixture: {
        fileName: 'porter.vc.json',
        text: await readFile(join(repositoryRoot, 'example/porter.vc.json'), 'utf8'),
      },
      parse: parseDocumentJSON,
      themes: WEBVIEW_THEMES,
      name: 'value-chain',
      screenshotDir: join(repositoryRoot, 'test-results/vscode-smoke'),
      vscodeVersion: process.env.VSCODE_VERSION || undefined,
      log: (line) => console.log(`[vscode-smoke] ${line}`),
    });
    console.log(formatVsCodeSmoke(result));
    expect(result.failures, result.failures.join('\n')).toEqual([]);
  },
);
