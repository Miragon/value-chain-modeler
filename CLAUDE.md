# CLAUDE.md

TypeScript library for viewing and editing value chain diagrams
(ARIS-style "Wertschöpfungskettendiagramme"), built on
[diagram-js](https://github.com/bpmn-io/diagram-js) (MIT) and styled by the Miragon design
system. Architecture mirrors the sibling repo `wardley-mapping`.

## Monorepo (npm workspaces)

| Package                             | Purpose                                                          | DOM |
| ----------------------------------- | ---------------------------------------------------------------- | --- |
| `@miragon/value-chain-schema-model` | Metamodel, Zod validation, migrations, stable JSON serialization | no  |
| `@miragon/value-chain-renderer`     | diagram-js bootstrap, renderer, modeler, import/export, CSS      | yes |
| `apps/webapp`                       | Vite editor app on the shell's web host                          | yes |
| `apps/vscode`                       | VS Code extension: `*.vc`/`*.vc.json` custom editor (esbuild)    | yes |
| `e2e`                               | Playwright: the webapp and the VS Code webview (shell kit, both) | yes |

**P1 — DOM boundary:** `schema-model` must never import diagram-js/DOM libraries
(`tiny-svg`, `min-dom`) or use `window`/`document`. Enforced twice — ESLint
(`no-restricted-imports`/`no-restricted-globals`) and `dependency-cruiser`. The same two tools
keep `@miragon/modeler-shell` out of every package (only the apps mount the chrome) and let
`schema-model` take nothing but types from `@miragon/modeler-api`.

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

Unknown keys on the document, `meta`, elements and connections survive load, every canvas edit
and serialization (vendor extensions); `bounds` and waypoints reject unknown keys, `vc-root` is a
reserved id (so are `__implicitroot…` and the names of `Object.prototype` members, which the
diagram-js element registry cannot hold), coordinates and sizes stay within ±1e9, and objects
and arrays nest at most 100 levels (`MAX_NESTING_DEPTH`, checked without recursion).
`documentIssues` reports every finding with its JSON path (the VS Code Problems view).

## Renderer architecture (mirrors wardley-renderer)

- Class chain `VcBaseViewer` → `Viewer` → `NavigatedViewer` → `Modeler`; each overrides
  `_getModules()`. DI bootstrap via `new Diagram({ canvas, modules })`, lazily created.
- One feature per folder with an `index.ts` exporting a didi `ModuleDeclaration`
  (`__init__` for eager providers/behaviors, `__depends__` for stock diagram-js modules).
- `draw/VcRenderer` extends BaseRenderer at priority 1500; chevron geometry lives in
  `draw/geometry.ts`; visual constants in `draw/styles.ts`: ink and fill are the light
  `--cd-ui-text` / `--cd-ui-plot` roles read from the vendored `cd-tokens.generated.json`, 2px
  round strokes, labels 12px in `'Geist Variable', 'Geist', …` set on every text node (guide §4),
  as presentation values, so exports stay light. Labels drawn before the web font arrived are laid
  out again once it has. Tool and chrome icons are Lucide, inlined in `draw/lucide.ts`.
- `src/theme/` holds the design system's `cd-tokens.generated.css`/`.json` and `cd-canvas.css`
  (1.13.0), vendored unchanged with a header; re-copy them from the
  `miragon-brand:modeler-tool-design` skill, never edit. `assets/value-chain.css` loads tokens
  (layered), `diagram-js.css`, `cd-canvas.css`, then styles only on `--cd-ui-*` roles;
  `test/theme.sync.test.ts` guards both, `apps/vscode/test/tokens.sync.test.ts` pins the shell's
  sizes to the vendored `shell` tokens. In-canvas overlays stay at `z-index` 100 or below.
- `collaborative/` implements the `@miragon/modeler-api` contract
  (`createCollaborativeModeler`/`createCollaborativeViewer`); `importDocument` validates first,
  erases the history silently (`clear(false)`), fits, and keeps an open label edit across the
  import. New elements get random ids. `test/browser/conformance.browser.test.ts` runs the kit,
  where a skip or an advisory fails.
- `read-only/VcReadOnly` is the edit lock of an invalid file; `diagram-menu/` holds the Export and
  Help entries and the shortcuts dialog both apps show, typed structurally (renderers never import
  the shell).
- Mutations funnel through `vcModeling.updateProperties` (one undoable command handler).
- `modeling/VcLayouter` + `CroppingConnectionDocking` crop connections at the chevron
  contour (via the renderer's `getShapePath`).
- Connection type during connect/create drags comes from `vcConnect.pendingType`
  (read by `VcRules`, reset on interaction cleanup).

## Commands

- `npm run build` — schema-model (tsup) + renderer (vite lib) · `npm run build:webapp` ·
  `npm run build:vscode` (esbuild, bundles packages from source)
- `npm run dev:webapp` — editor at http://localhost:5181 · `npm run dev:vscode` — watch build
- `npm test` — unit (node; `packages/*/test` and `apps/*/test`, with a `vscode` mock) ·
  `npm run test:browser` — Chromium (vitest browser mode; jsdom lacks `getBBox`, so renderer
  integration tests must be browser tests) · `npm run test:e2e` — Playwright in `e2e/`, project
  `webapp` (port `E2E_PORT`, default 5181) and `vscode-webview` (the webview inside the shell's
  VS Code stub, port `E2E_WEBVIEW_PORT`, default 5191)
- `npm run check:build -w apps/webapp` — after `build:webapp`: the head markup and the licence
  comments the production bundle must carry
- `npm run lint` — ESLint + typecheck · `npm run depcruise` — module-graph rules

Build packages before running unit tests (workspace deps resolve to `dist`).
CI (`.github/workflows/ci.yml`) runs lint, unit, browser, e2e, depcruise, build,
format-check, pin-check; releases via release-please (lockstep versions, npm publish for
packages/\* via trusted publishing, Marketplace publish for apps/vscode) — see
[`CONTRIBUTING.md`](CONTRIBUTING.md#releasing).

## Conventions

- Pin **all** dependencies to exact versions — no ranges; workspace cross-deps use the
  exact current workspace version (release-please bumps them in lockstep). The one exception:
  the runtime libs a host shares are ranged `peerDependencies` — `zod` (schema-model, renderer)
  and `diagram-js`/`didi`/`tiny-svg` (renderer) — so a host dedupes them; a second copy breaks
  `instanceof`, schema identity and the diagram-js injector. Each is mirrored by an exact
  devDependency, and the apps take them as exact dependencies. See
  `.claude/rules/package-json-fixed-versions.md`.
- Keep `schema-model` DOM-free (P1). JSON serialization must stay deterministic
  (sorted ids, sorted keys, 3-decimal rounding).
- Conventional Commits (`feat(renderer): …`, `fix(webapp): …`).
- For value-chain domain work (notation, `*.vc` / `*.vc.json`), use the skill in
  [`.claude/skills/value-chain-modeling/`](.claude/skills/value-chain-modeling/).
- Contributor onboarding in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- The VS Code webview mounts `@miragon/modeler-shell` (`mountVsCodeShell`, IDE host, themes
  `['light']`); the extension host renders its HTML with `renderWebviewHtml` and runs the theme
  bridge. Undo belongs to the document (`undoRedoKeys: false`); an invalid file locks the canvas
  (`vcReadOnly` + `shell.setReadOnly`). `apps/vscode/THIRD_PARTY_NOTICES.md` is generated
  (`npm run notices -w apps/vscode`) and checked by a unit test.
- The web app mounts the same shell on its web host (`mountShell`, `host: 'web'`, themes
  `['light']`): File/Export/Help menu, Share, legal line, toasts, start screen, drop zone; no
  problems list, since a document that validates imports without warnings. `index.html` is static `data-cd-theme="light"`; the Vite plugin puts `webHeadMarkup` in place
  of `<!-- miragon-mode -->`. It runs `createCollaborativeModeler` (canvas undo keys on), autosaves
  the canonical JSON in `localStorage` and writes a share link (`#mz=`, deflate-raw) only on Share;
  the address bar keeps it only while it holds the diagram on the canvas. Replacing a diagram
  offers Undo instead of `confirm()`. `window.__valueChainApp` (shell, modeler, connection,
  `destroy()`) is the e2e handle.
- Write comments only for constraints the code cannot express itself.
