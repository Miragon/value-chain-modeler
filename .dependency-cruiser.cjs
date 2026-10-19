/**
 * DOM-boundary enforcement at the module-graph level.
 * Complements the ESLint rule: forbids the DOM-free schema-model package from depending on
 * diagram-js / DOM libraries or on the DOM-dependent @miragon/value-chain-renderer, keeps
 * @miragon/modeler-shell out of every package and the contract's runtime out of schema-model.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'dom-free-no-diagram-js',
      comment: 'DOM-free packages must not import diagram-js / DOM libraries.',
      severity: 'error',
      from: { path: '^packages/schema-model/src' },
      to: { path: 'node_modules/(diagram-js|tiny-svg|min-dom)' },
    },
    {
      name: 'dom-free-no-renderer',
      comment: 'DOM-free packages must not depend on the DOM-dependent renderer.',
      severity: 'error',
      from: { path: '^packages/schema-model/src' },
      to: { path: '^packages/renderer/src' },
    },
    {
      name: 'packages-no-shell',
      comment:
        'The renderer and the DOM-free package never import @miragon/modeler-shell; only the apps ' +
        'mount the shell (dependency direction of Miragon/modeler-api#4).',
      severity: 'error',
      from: { path: '^packages/[^/]+/src' },
      // Matched on the specifier, so an import that does not resolve from the package fails too.
      to: { path: '@miragon/modeler-shell' },
    },
    {
      name: 'dom-free-contract-types-only',
      comment: 'The DOM-free package takes only types from @miragon/modeler-api, never runtime code.',
      severity: 'error',
      from: { path: '^packages/schema-model/src' },
      to: { path: '@miragon/modeler-api', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
