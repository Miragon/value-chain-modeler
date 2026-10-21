import { readFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { dirname } from 'node:path';
import { compileFunction } from 'node:vm';
import type { BuildOptions } from 'esbuild';
import { beforeEach, describe, expect, it } from 'vitest';
import * as vscodeStub from './__mocks__/vscode';
import { vscodeMock } from './__mocks__/vscode';

interface Extension {
  activate(context: { extensionUri: unknown; subscriptions: { dispose(): unknown }[] }): void;
}

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  contributes: { customEditors: { viewType: string }[]; commands: { command: string }[] };
};

/** The extension host bundle exactly as `vscode:prepublish` builds it for the VSIX. */
async function buildProductionHostBundle(): Promise<{ code: string; path: string }> {
  // A computed specifier: the config is untyped JavaScript, loaded by Node, not compiled by Vite.
  const configUrl = new URL('../esbuild.config.mjs', import.meta.url).href;
  const { bundleOptions } = (await import(/* @vite-ignore */ configUrl)) as {
    bundleOptions(mode: { production: boolean }): { host: BuildOptions };
  };
  const { host } = bundleOptions({ production: true });
  const esbuild = await import('esbuild');
  const result = await esbuild.build({ ...host, write: false, logLevel: 'silent' });
  const [output] = result.outputFiles;
  if (!output) throw new Error('esbuild produced no extension host bundle');
  return { code: output.text, path: output.path };
}

/** Runs the bundle the way VS Code does: `vscode` from the host, Node's built-ins, nothing else. */
function loadBundle({ code, path }: { code: string; path: string }): Extension {
  const nodeRequire = createRequire(path);
  const require = (id: string): unknown => {
    if (id === 'vscode') return vscodeStub;
    if (isBuiltin(id)) return nodeRequire(id);
    throw new Error(`the bundle requires "${id}" at runtime, which the VSIX does not ship`);
  };
  const module = { exports: {} };
  compileFunction(code, ['exports', 'require', 'module', '__filename', '__dirname'], {
    filename: path,
  })(module.exports, require, module, path, dirname(path));
  return module.exports as Extension;
}

beforeEach(() => vscodeMock.reset());

// The VSIX ships dist/extension.cjs without node_modules: a require esbuild leaves in the bundle
// throws on activation, and VS Code then shows the diagram editor loading forever.
describe('the production extension host bundle', () => {
  it('activates with only vscode and Node, registering the editor and every command', async () => {
    const extension = loadBundle(await buildProductionHostBundle());

    extension.activate({ extensionUri: vscodeStub.Uri.file('/ext'), subscriptions: [] });

    expect(vscodeMock.registeredEditors().map((editor) => editor.viewType)).toEqual(
      manifest.contributes.customEditors.map((editor) => editor.viewType),
    );
    expect(vscodeMock.registeredCommandIds().sort()).toEqual(
      manifest.contributes.commands.map((command) => command.command).sort(),
    );
  }, 60_000);
});
