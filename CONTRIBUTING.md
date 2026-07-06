# Contributing

Thanks for contributing to the Value Chain Modeler! This is an npm-workspaces monorepo
(Node ≥ 22.13, npm, TypeScript ESM). AI agents: start with [`CLAUDE.md`](CLAUDE.md).

## Setup & inner loop

```bash
npm install
npm run build   # builds packages/* (workspace deps resolve to dist — build before testing)
npm test        # vitest run
npm run lint    # eslint . + type-check (same check the pre-commit hook runs)
```

Extras: `npm run dev:webapp` (editor at http://localhost:5181), `npm run dev:vscode`
(extension watch build), `npm run depcruise` (module-graph rules), `npm run format`.

## Browser & e2e tests

- `npm run test:browser` — renderer integration tests in real Chromium (Vitest browser mode;
  jsdom lacks `getBBox`).
- `npm run test:e2e` — Playwright tests against the webapp (in `e2e/`).

Both need Chromium: locally run `npx playwright install chromium` once; CI uses the
Playwright container. When bumping `@playwright/test` in `e2e/package.json`, also bump the
container image tag in `.github/workflows/ci.yml` — the pin-check does not catch this.

## Pre-commit reality

The Husky pre-commit hook runs only `lint-staged` + `npm run lint` — not tests, build, or
depcruise. Run `npm test` and `npm run depcruise` yourself before pushing. Avoid
`--no-verify`.

## Commit convention

Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`):

```
feat(renderer): add milestone element
fix(webapp): flush autosave on pagehide
docs: add contributing guide
```

## Monorepo map & the DOM boundary (P1)

| Package                             | Purpose                                                          | DOM |
| ----------------------------------- | ---------------------------------------------------------------- | --- |
| `@miragon/value-chain-schema-model` | Metamodel, Zod validation, migrations, stable JSON serialization | no  |
| `@miragon/value-chain-renderer`     | diagram-js viewer/modeler, chevron renderer, import/export, CSS  | yes |
| `apps/webapp`                       | Vite demo editor                                                 | yes |
| `apps/vscode`                       | VS Code extension: custom editor for `*.vc.json`                 | yes |
| `e2e`                               | Playwright end-to-end tests against the webapp                   | yes |

`schema-model` must never import diagram-js/`tiny-svg`/`min-dom` or use `window`/`document` —
enforced by both ESLint and dependency-cruiser. JSON serialization must stay deterministic
(sorted ids, sorted keys, 3-decimal rounding).

## Pull requests

Keep PRs small and focused. Local gates before opening one: `npm run lint`, `npm test`,
`npm run depcruise`, `npm run build`. For value-chain domain work, use the skill in
[`.claude/skills/value-chain-modeling/`](.claude/skills/value-chain-modeling/).
