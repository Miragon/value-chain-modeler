---
paths:
  - '**/package.json'
---

# Always use fixed dependency versions

Never use version ranges (`^`, `~`, `>=`, `*`) in `package.json`.
Always pin to an exact version (e.g. `"eslint": "9.39.4"`).

This applies to `dependencies` and `devDependencies` — including internal
`@miragon/value-chain-*` workspace deps, which are pinned to the exact current workspace version
(not `*` or `workspace:*`); npm links them locally because the versions match, and release-please
bumps them in lockstep.

**Exception — `peerDependencies`:** the runtime libs a host shares with the packages are declared
as **ranged** peers — `zod` in `schema-model` and `renderer`, `diagram-js`, `didi` and `tiny-svg`
in `renderer` — so a host such as Design IQ dedupes them against its own copy instead of getting
a second, exact-pinned one: duplicate `zod`/diagram-js instances break `instanceof`, schema
identity and the diagram-js DI injector. Every ranged peer is mirrored by an **exact**
`devDependency` that satisfies the range (for local build and test), and the bundling apps
(`webapp`, `vscode`) declare it as an exact `dependency`. The `miragon/pin-npm-dependencies`
check does not inspect `peerDependencies`, so these ranges pass CI.
Exact pinning is enforced in CI by
[`miragon/pin-npm-dependencies`](https://github.com/Miragon/pin-npm-dependencies).

When adding a new dependency: install it first with `npm install <pkg>` (the root `.npmrc` sets `save-exact=true`, so npm pins the exact version), then verify the installed version with `npm ls <pkg>` or in `package-lock.json` and make sure that exact version is written into `package.json`.
