# CLAUDE.md

TypeScript library for viewing and editing value chain diagrams
(ARIS-style "Wertschöpfungskettendiagramme"), built on
[diagram-js](https://github.com/bpmn-io/diagram-js) (MIT) with bpmn.io look & feel.
Architecture mirrors the sibling repo `wardley-mapping`.

## Monorepo (npm workspaces)

| Package                             | Purpose                                                          | DOM |
| ----------------------------------- | ---------------------------------------------------------------- | --- |
| `@miragon/value-chain-schema-model` | Metamodel, Zod validation, migrations, stable JSON serialization | no  |
| `@miragon/value-chain-renderer`     | diagram-js bootstrap, renderer, modeler, import/export, CSS      | yes |
| `apps/webapp`                       | Vite editor app                                                  | yes |
| `apps/vscode`                       | VS Code extension: custom editor for `*.vc.json` (esbuild)       | yes |
| `e2e`                               | Playwright end-to-end tests against the webapp                   | yes |

**P1 — DOM boundary:** `schema-model` must never import diagram-js/DOM libraries
(`tiny-svg`, `min-dom`) or use `window`/`document`. Enforced twice — ESLint
(`no-restricted-imports`/`no-restricted-globals`) and `dependency-cruiser`.

## Domain model

Persisted JSON (`schema-model`): `step` (chevron) and `orgUnit` (ellipse) elements +
`sequence`/`hierarchy`/`assignment` connections ("ist Vorgänger von" dashed with arrow /
"ist prozessorientiert übergeordnet" solid with arrow / org-unit assignment plain solid).
Hierarchy routing adapts to the sub-steps' arrangement (shared predicate
`isRowArrangement` in `VcLayouter`): a horizontal row gets vertical drops into the tops,
a vertical column gets the ARIS rake into the left notches;
`VcHierarchyRelayoutBehavior` re-routes the whole sibling group when the arrangement
flips. The relation/element-type matrix is enforced in `validateDocument` and in
`VcRules` (an org unit endpoint always resolves to `assignment`). While editing, the
truth lives as flat props on the diagram-js elements (`vcType`, `vcLabel`, `color`);
`businessObject` is only an import snapshot. The exporter rebuilds documents from
element props and validates via `validateDocument`.

## Renderer architecture (mirrors wardley-renderer)

- Class chain `VcBaseViewer` → `Viewer` → `NavigatedViewer` → `Modeler`; each overrides
  `_getModules()`. DI bootstrap via `new Diagram({ canvas, modules })`, lazily created.
- One feature per folder with an `index.ts` exporting a didi `ModuleDeclaration`
  (`__init__` for eager providers/behaviors, `__depends__` for stock diagram-js modules).
- `draw/VcRenderer` extends BaseRenderer at priority 1500; chevron geometry lives in
  `draw/geometry.ts`; visual constants in `draw/styles.ts` (bpmn.io values: ink
  `hsl(225,10%,15%)`, 2px round strokes, Arial 12px).
- Mutations funnel through `vcModeling.updateProperties` (one undoable command handler).
- `modeling/VcLayouter` + `CroppingConnectionDocking` crop connections at the chevron
  contour (via the renderer's `getShapePath`).
- Connection type during connect/create drags comes from `vcConnect.pendingType`
  (read by `VcRules`, reset on interaction cleanup).

## Commands

- `npm run build` — schema-model (tsup) + renderer (vite lib) · `npm run build:webapp` ·
  `npm run build:vscode` (esbuild, bundles packages from source)
- `npm run dev:webapp` — editor at http://localhost:5181 · `npm run dev:vscode` — watch build
- `npm test` — unit (node) · `npm run test:browser` — Chromium (vitest browser mode;
  jsdom lacks `getBBox`, so renderer integration tests must be browser tests) ·
  `npm run test:e2e` — Playwright against the webapp (in `e2e/`)
- `npm run lint` — ESLint + typecheck · `npm run depcruise` — module-graph rules

Build packages before running unit tests (workspace deps resolve to `dist`).
CI (`.github/workflows/ci.yml`) runs lint, unit, browser, e2e, depcruise, build,
format-check, pin-check; releases via release-please (lockstep versions, npm publish for
packages/\*, Marketplace publish for apps/vscode).

## Conventions

- Pin **all** dependencies to exact versions — no ranges; workspace cross-deps use the
  exact current version (`0.1.0`). See `.claude/rules/package-json-fixed-versions.md`.
- Keep `schema-model` DOM-free (P1). JSON serialization must stay deterministic
  (sorted ids, sorted keys, 3-decimal rounding).
- Conventional Commits (`feat(renderer): …`, `fix(webapp): …`).
- For value-chain domain work (notation, `*.vc.json`), use the skill in
  [`.claude/skills/value-chain-modeling/`](.claude/skills/value-chain-modeling/).
- Contributor onboarding in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Write comments only for constraints the code cannot express itself.
