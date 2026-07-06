import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The webapp bundles the @miragon/value-chain-* packages straight from SOURCE (like the
// tsconfig paths). This keeps the build self-contained: no prior lib build / no dist CSS
// filename needed. Ordering: the specific CSS subpath BEFORE the package alias.
const r = (p: string): string => resolve(__dirname, p);

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
  server: { port: 5181, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
