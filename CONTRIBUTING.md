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
  jsdom lacks `getBBox`), the `@miragon/modeler-api` conformance kit included.
- `npm run test:e2e` — Playwright tests in `e2e/`, two projects with a dev server each:
  `webapp` (the web app, `E2E_PORT`, default 5181; it runs the `@miragon/modeler-shell`
  conformance kit on the web host and the app's own chrome handlers) and `vscode-webview` (the
  VS Code webview from source inside the shell's VS Code stub, `E2E_WEBVIEW_PORT`, default 5191;
  it runs the kit on the IDE host and a CSP smoke test of the production bundle). One project:
  `npm run test:e2e -- --project=vscode-webview`. Set both ports when another checkout already
  serves the defaults.

Both need Chromium: locally run `npx playwright install chromium` once; CI uses the
Playwright container. When bumping `@playwright/test` in `e2e/package.json`, also bump the
container image tag in `.github/workflows/ci.yml` — the pin-check does not catch this.

## VS Code smoke test

`npm run test:vscode` packages the extension as the release does (`vsce package
--no-dependencies`, which runs `vscode:prepublish`), unpacks the VSIX and starts it in a real
VS Code through `runVsCodeSmoke` of `@miragon/modeler-shell/testing/vscode-electron`. It opens
`example/porter.vc.json` in the diagram editor, checks the chrome, creates a step from the
palette, saves (the file must pass `parseDocumentJSON`), undoes, and switches through VS Code's
four default themes with a screenshot each in `test-results/vscode-smoke/` (gitignored). It is
not part of `npm test`: it needs a display and downloads VS Code. It runs on the unpacked VSIX,
not on `apps/vscode`, because only there a module the bundle requires but does not contain fails
as it does for users.

- **macOS, locally:** `npm run test:vscode` (no build needed, the extension bundles the packages
  from source; `unzip` comes with macOS). A VS Code window opens for a few seconds. The first run
  downloads VS Code (about 320 MB, 0.9 GB unpacked) into
  `~/Library/Caches/miragon-modeler-shell/vscode-test`, which every Miragon modeler shares; later
  runs take about 5 s. Let a first download finish before starting a second run.
  `VSCODE_SMOKE_VERSION=1.96.0 npm run test:vscode` tests another VS Code release, such as the
  `engines.vscode` floor; without it the newest stable release runs. Run from an AI agent, add
  `-- --reporter=default`: Vitest's agent reporter hides the log of a passing test, VS Code's
  version and the timings included.
- **Linux and CI:** VS Code needs an X server, `xvfb-run -a npm run test:vscode`.
  [`.github/workflows/vscode-smoke.yml`](.github/workflows/vscode-smoke.yml) runs it on
  `ubuntu-latest` every Monday, on demand (**Run workflow**, optionally with a VS Code version)
  and on pull requests that change what ships in the VSIX (`apps/vscode`, the packages' sources,
  `package-lock.json`), the fixture, the root `package.json` or the setup action. It caches VS Code
  per version, uploads the screenshots as the `vscode-smoke` artifact, and is not a required check.

The test is retried once, and only when the save step reports that the saved text does not parse:
the driver of `@miragon/modeler-shell` 0.3.0 can read the file in the moment VS Code has emptied it
but not yet written it (about one run in twenty). The retry does not pack the VSIX again; every
other failure fails at once. A save that really writes broken JSON fails both attempts.

## Design tokens

`packages/renderer/src/theme/` vendors `cd-tokens.generated.css`, `cd-tokens.generated.json` and
`cd-canvas.css` from the `miragon-brand:modeler-tool-design` skill (Miragon/corporate-identity)
unchanged. To update, copy the three files again, put the vendoring header (with the new design
system version) back on top of the two CSS files, and adjust `theme.sync.test.ts`; never edit
their values. When a dependency of the VS Code extension changes, run
`npm run notices -w apps/vscode` and commit `THIRD_PARTY_NOTICES.md`.

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
| `apps/webapp`                       | Vite editor app on the shell's web host                          | yes |
| `apps/vscode`                       | VS Code extension: custom editor for `*.vc` / `*.vc.json`        | yes |
| `e2e`                               | Playwright: the webapp and the VS Code webview                   | yes |

`schema-model` must never import diagram-js/`tiny-svg`/`min-dom` or use `window`/`document` —
enforced by both ESLint and dependency-cruiser. JSON serialization must stay deterministic
(sorted ids, sorted keys, 3-decimal rounding).

## Pull requests

Keep PRs small and focused. Local gates before opening one: `npm run lint`, `npm test`,
`npm run depcruise`, `npm run build`, for a web app change `npm run build:webapp` with
`npm run check:build -w apps/webapp`, and for an extension change `npm run test:vscode`. For
value-chain domain work, use the skill in
[`.claude/skills/value-chain-modeling/`](.claude/skills/value-chain-modeling/).

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please):
every push to `main` updates a `chore: release main` PR from the Conventional Commits since
the last release. All workspaces share one version (`linked-versions`). Merging that PR tags
the release and publishes:

- `@miragon/value-chain-schema-model` and `@miragon/value-chain-renderer` to npm, via
  [trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub OIDC, no npm token,
  provenance attached). The job runs in the `npm` environment.
- the VS Code extension to the Marketplace (`VSCE_PUBLISH` secret, `vscode-marketplace`
  environment).

Never bump versions or edit `CHANGELOG.md` by hand. To validate packaging without releasing,
run the **Release** workflow manually with `dry_run` enabled.

Each npm package has a trusted publisher configured on npmjs.com (repository
`Miragon/value-chain-modeler`, workflow `release-please.yml`, environment `npm`). A **new**
package must exist on npm before a trusted publisher can be attached, so publish it once by
hand as `0.0.1`, then:

```bash
npm trust github @miragon/value-chain-<name> --repo Miragon/value-chain-modeler \
  --file release-please.yml --env npm --allow-publish
```

If a release already ran before that (the publish job fails with "does not exist on npm
yet"), re-run its failed jobs afterwards: `gh run rerun <run-id> --failed`.
