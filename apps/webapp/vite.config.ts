import { resolve } from 'node:path';
import { webHeadMarkup } from '@miragon/modeler-shell/core';
import { defineConfig, type Plugin } from 'vite';
import tokens from '../../packages/renderer/src/theme/cd-tokens.generated.json' with { type: 'json' };
import { THEMES } from './src/themes.ts';

// The webapp bundles the @miragon/value-chain-* packages straight from SOURCE (like the
// tsconfig paths). This keeps the build self-contained: no prior lib build / no dist CSS
// filename needed. Ordering: the specific CSS subpath BEFORE the package alias.
const r = (p: string): string => resolve(import.meta.dirname, p);

/**
 * The web app's mode before the first paint (guide §13.3): a light-only diagram writes
 * `data-cd-theme="light"` statically in index.html, one theme-color and the contrast line of the
 * guide's script. With the joint dark-mode release THEMES gains "dark" and the same call writes
 * the whole script with both theme-colors (index.html then says `data-cd-theme="system"`).
 */
const modeMarkup = (): Plugin => ({
  name: 'miragon-mode',
  transformIndexHtml: (html) =>
    html.replace(
      '<!-- miragon-mode -->',
      webHeadMarkup({
        themes: THEMES,
        themeColors: { light: tokens.fest['--cd-blau'], dark: tokens.dunkel['--cd-ui-grund'] },
      }),
    ),
});

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@miragon/value-chain-renderer/assets/value-chain.css',
        replacement: r('../../packages/renderer/src/assets/value-chain.css'),
      },
      {
        find: '@miragon/value-chain-renderer',
        replacement: r('../../packages/renderer/src/index.ts'),
      },
      {
        find: '@miragon/value-chain-schema-model',
        replacement: r('../../packages/schema-model/src/index.ts'),
      },
    ],
  },
  plugins: [modeMarkup()],
  server: { port: 5181, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The shell and the renderer inline Lucide's icon geometry (ISC, partly Feather, MIT) and name
    // both licences in a legal comment; the bundle keeps it, as their notices ask.
    rolldownOptions: { output: { comments: { legal: true } } },
  },
});
