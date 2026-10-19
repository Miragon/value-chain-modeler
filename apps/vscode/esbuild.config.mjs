// Two bundles from one run:
//   1. Extension host  (Node/CJS, `vscode` external)  -> dist/extension.cjs
//   2. Webview          (Browser/IIFE, Modeler+CSS)    -> dist/webview.js (+ dist/webview.css)
//
// Like the demo webapp, we bundle the @miragon/value-chain-* packages straight from SOURCE
// (aliased to src/index.ts). That makes the build self-contained: no prior lib build needed,
// and the diagram-js imports resolve relative to the renderer source. @miragon/modeler-shell
// comes from node_modules in both bundles.
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

const r = (p) => resolve(root, p);

/** Package aliases pointing at the TS source (mirrors apps/webapp/vite.config.ts). */
const alias = {
  '@miragon/value-chain-renderer': r('packages/renderer/src/index.ts'),
  '@miragon/value-chain-schema-model': r('packages/schema-model/src/index.ts'),
};

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

/** @type {import('esbuild').BuildOptions} */
const host = {
  ...common,
  entryPoints: [resolve(here, 'src/extension.ts')],
  outfile: resolve(here, 'dist/extension.cjs'),
  platform: 'node',
  format: 'cjs',
  // VS Code 1.96 (engines) runs extensions on Node 20; the shell's createNonce needs its
  // globalThis.crypto.
  target: 'node20',
  alias,
  // `vscode` is only available at runtime (from the host) and must not be bundled.
  external: ['vscode'],
};

/** @type {import('esbuild').BuildOptions} */
const web = {
  ...common,
  entryPoints: [resolve(here, 'src/webview/main.ts')],
  outfile: resolve(here, 'dist/webview.js'),
  platform: 'browser',
  // renderWebviewHtml writes a classic <script nonce>.
  format: 'iife',
  target: 'es2022',
  alias,
  // Font files next to the bundle, not inlined: Geist Mono alone brings six subsets, and as
  // separate files the browser fetches only the ones a page's unicode-range needs. The CSP of
  // renderWebviewHtml allows fonts from cspSource, and dist/ is the webview's resource root.
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]-[hash]',
};

if (watch) {
  const ctxs = await Promise.all([esbuild.context(host), esbuild.context(web)]);
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log('[value-chain-vscode] watching …');
} else {
  await Promise.all([esbuild.build(host), esbuild.build(web)]);
  console.log('[value-chain-vscode] build done');
}
