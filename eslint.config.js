// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Flat Config. The most important project-specific piece is DOM-boundary enforcement:
 * the DOM-free package (schema-model) must not import diagram-js or any DOM library/global.
 * Only the apps mount @miragon/modeler-shell; the packages never import it, and the DOM-free
 * package takes nothing but types from @miragon/modeler-api.
 */

const DOM_RESTRICTED_IMPORTS = {
  paths: [
    { name: 'diagram-js', message: 'DOM-free packages must not import diagram-js.' },
    { name: 'tiny-svg', message: 'DOM-free packages must not import tiny-svg.' },
    { name: 'min-dom', message: 'DOM-free packages must not import min-dom.' },
    { name: '@miragon/modeler-shell', message: 'Only the apps mount the shell.' },
    {
      name: '@miragon/modeler-api',
      allowTypeImports: true,
      message: 'DOM-free packages take only types from the contract.',
    },
  ],
  patterns: [
    {
      group: ['diagram-js/*'],
      message: 'DOM-free packages must not import diagram-js.',
    },
    { group: ['@miragon/modeler-shell/*'], message: 'Only the apps mount the shell.' },
    {
      group: ['@miragon/modeler-api/*'],
      allowTypeImports: true,
      message: 'DOM-free packages take only types from the contract.',
    },
  ],
};

const SHELL_RESTRICTED_IMPORTS = {
  paths: [{ name: '@miragon/modeler-shell', message: 'Renderers never import the shell.' }],
  patterns: [{ group: ['@miragon/modeler-shell/*'], message: 'Renderers never import the shell.' }],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'eslint.config.js',
      '**/*.config.{js,ts,mjs,cjs}',
      '.dependency-cruiser.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  // DOM-dependent packages/apps: browser globals allowed.
  {
    files: ['packages/renderer/**/*.ts', 'apps/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // The renderer draws the canvas; the chrome around it is the apps' (dependency direction of
  // Miragon/modeler-api#4).
  {
    files: ['packages/renderer/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', SHELL_RESTRICTED_IMPORTS],
    },
  },
  // DOM-FREE packages: hard boundary.
  {
    files: ['packages/schema-model/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-restricted-imports': ['error', DOM_RESTRICTED_IMPORTS],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'DOM-free package: no window.' },
        { name: 'document', message: 'DOM-free package: no document.' },
      ],
    },
  },
  // Tests may be more lenient.
  {
    files: ['**/*.{test,spec}.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
);
