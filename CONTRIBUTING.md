# Contributing

Thanks for contributing to the Value Chain Modeler! This is an npm-workspaces monorepo
(Node ≥ 22.13, npm, TypeScript ESM). AI agents: start with [`CLAUDE.md`](CLAUDE.md).

## External contributions

We're currently not accepting pull requests from outside the team. We don't have the resources to fully review and validate external contributions, so we can't guarantee that a merged change keeps the project free of bugs, free of security vulnerabilities or malicious code, and consistent with requirements that make sense for it. Pull requests opened by external contributors will be closed.

If you've found a bug or have an idea, please [open an issue](https://github.com/Miragon/value-chain-modeler/issues/new) instead. We read every one, and it's the best way to get something onto our radar.

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

Both need Chromium: locally run `npx playwright install chromium` once; CI runs them in the
Playwright container, whose tag the `playwright-version` job reads from the root `playwright` pin.
Bump `playwright`, `@playwright/test` (`e2e/package.json`) and `playwright-core`
(`apps/vscode/package.json`) together, as Dependabot does: `pin-check` fails when they disagree.

## VS Code smoke test

`npm run test:vscode` packages the extension as the release does (`vsce package
--no-dependencies`, which runs `vscode:prepublish`), unpacks the VSIX and starts it in a real
VS Code through `runVsCodeSmoke` of `@miragon/modeler-shell/testing/vscode-electron`. It opens
`example/porter.vc.json` in the diagram editor, checks the chrome, creates a step from the
palette, saves (the file must pass `parseDocumentJSON`), undoes, and switches through VS Code's
four default themes with a screenshot each in `test-results/vscode-smoke/` (gitignored). It is
not part of `npm test`: it needs a display and downloads VS Code. It runs on the unpacked VSIX,
not on `apps/vscode`, because only there a module the bundle requires but does not contain fails
as it does for users. With `VSCODE_SMOKE_VSIX` set to a `.vsix` file it tests that file instead of
packing one; the release does so with the VSIX it is about to publish.

- **Locally, without a window:** `npm run test:vscode:docker` runs the same test in a Linux
  container under `xvfb-run -a`, through `modeler-shell-vscode-docker` of `@miragon/modeler-shell`,
  so no VS Code window opens and nothing takes the focus. It needs Docker (Docker Desktop on
  macOS) and no build. The first run builds the image
  `modeler-shell-vscode-smoke:node<version>-<hash>` (`node:<version>-bookworm-slim` with Xvfb and
  Electron's libraries, about 0.9 GB, for the Node version that runs the command) and downloads
  VS Code into the Docker volume `modeler-shell-vscode-cache`, which every Miragon modeler shares.
  Each run copies the repository into the container without `node_modules` and `.git`, runs
  `npm ci` there (your `node_modules` stay as they are) and copies `test-results/vscode-smoke/`
  back; with the image and VS Code cached it takes about 12 s. Variables go in only with `--env`,
  as in `npm run test:vscode:docker -- --env VSCODE_VERSION=1.96.0`; `--env` without a value
  passes on the value set on the host:
  `VSCODE_VERSION=1.96.0 npm run test:vscode:docker -- --env VSCODE_VERSION`. A
  variable set in front of `npm` alone stays on the host: the test then runs the newest VS Code
  and passes without a warning. The log shows the container's paths (`/work/…`) and, as Vitest
  finds no AI agent there, the whole log of a passing test, so the command needs no reporter flag
  (it rejects `--reporter=default` as an unknown option).
  `docker volume rm modeler-shell-vscode-cache modeler-shell-npm-cache` starts over.
- **macOS, with the window:** `npm run test:vscode` (no build needed, the extension bundles the
  packages from source; `unzip` comes with macOS). A VS Code window opens for a few seconds and
  takes the focus. The first run
  downloads VS Code (about 320 MB, 0.9 GB unpacked) into
  `~/Library/Caches/miragon-modeler-shell/vscode-test`, which every Miragon modeler shares; later
  runs take about 5 s. Let a first download finish before starting a second run.
  `VSCODE_VERSION=1.96.0 npm run test:vscode` tests another VS Code release, such as the
  `engines.vscode` floor; without it the newest stable release runs. Run from an AI agent, add
  `-- --reporter=default`: Vitest's agent reporter hides the log of a passing test, VS Code's
  version and the timings included.
- **Linux and CI:** VS Code needs an X server, `xvfb-run -a npm run test:vscode`.
  [`.github/workflows/vscode-smoke.yml`](.github/workflows/vscode-smoke.yml) runs it on
  `ubuntu-latest` on the newest stable VS Code and on the `engines.vscode` minimum, caches VS Code
  per version and uploads the screenshots as the `vscode-smoke-stable` and `vscode-smoke-minimum`
  artifacts; [CI and the merge gate](#ci-and-the-merge-gate) says when it runs. It runs the test
  on the runner, not through `test:vscode:docker`: a runner has no window to keep in the
  background, and the container would build its image, run `npm ci` a second time and keep VS Code
  out of the Actions cache on every run.

The test runs once, without a retry. The save step of `@miragon/modeler-shell` 0.3.2 waits until
the editor tab is clean and two reads of the file agree before it parses the saved text, so it no
longer sees the file VS Code has emptied but not yet written; a save that writes broken JSON fails.

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

## CI and the merge gate

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests, in the merge queue and
on pushes to `main`. Its last job, **`ci-ok`, is the merge gate**: it needs every other job of the
workflow and fails unless each of them succeeded. A cancelled job fails it, and so does a job
skipped because a job it needs failed: a failed `lint` skips `e2e` and `test-browser`, and a
required check would count those skips as passed. The one accepted skip is `dependency-review`
outside pull requests, where its own `if:` skips it by design (`SKIPPED_BY_DESIGN` in `ci-ok`).

**A new CI job goes into the `needs` of `ci-ok`**, or it blocks no merge. A job that skips itself
on some events by design also goes into `SKIPPED_BY_DESIGN` for those events. CodeQL
([`codeql.yml`](.github/workflows/codeql.yml)) is a workflow of its own and reports its own check,
`Analyze (javascript-typescript)`, outside `ci-ok`.

The job `vscode-smoke` calls [`vscode-smoke.yml`](.github/workflows/vscode-smoke.yml), whose first
job, `changes`, decides whether VS Code starts. On a pull request, a push and a merge group it
compares the commit with its base (the pull request's base commit, the commit before the push, the
merge group's base commit) and starts VS Code only when one of these changed: `package-lock.json`,
any `package.json`, `apps/vscode/**`, `packages/**`, `tsconfig.base.json` (esbuild compiles the
VSIX's bundles with its options), `example/porter.vc.json`, `.github/actions/setup/**`, `ci.yml`,
`vscode-smoke.yml` or `vscode-smoke-weekly.yml`. A moved file counts under its old and its new
path, so moving a file out of `apps/vscode/**` starts VS Code too. Without a base commit (missing
or all zeros), when the base cannot be fetched, on a schedule and on a manual run it always starts
VS Code. Its job `vscode-smoke` then runs the test on the newest stable VS Code and on the minimum
of `engines.vscode` in `apps/vscode/package.json`, both resolved at run time. When nothing relevant
changed, the job `skipped` succeeds with a notice instead, so `ci-ok` sees a success, never a skip.

[`vscode-smoke-weekly.yml`](.github/workflows/vscode-smoke-weekly.yml) runs the same workflow every
Monday and on demand, which catches a new VS Code release. When it fails, it opens the issue
"VS Code smoke: the weekly run failed", or comments on it while it is open.

## Dependency updates

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) groups the npm updates of a week
into one pull request (`npm-dependencies`) and the GitHub Actions updates of a month into another;
[`dependabot-automerge.yml`](.github/workflows/dependabot-automerge.yml) merges patch and minor
updates once CI passes. `@miragon/modeler-*` (the modeler contract and the shared chrome) come in a
pull request of their own (`modeler-platform`) that is never auto-merged: a `chore(deps)` merge is
never released, and a 0.x minor of `@miragon/modeler-shell` changes the chrome in a breaking way.
Adopt it by hand and merge it as `fix(deps): adopt modeler-shell x.y`, so release-please releases
it.

## Pull requests

Keep PRs small and focused. Local gates before opening one: `npm run lint`, `npm test`,
`npm run depcruise`, `npm run build`, for a web app change `npm run build:webapp` with
`npm run check:build -w apps/webapp`, and for an extension change `npm run test:vscode:docker`
(or `npm run test:vscode`). For
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
  environment), once the smoke test has passed on the very VSIX it uploads (newest stable VS Code,
  under `xvfb-run -a`). A broken VSIX stops the job before `vsce publish` and leaves its
  screenshots as the artifact `vscode-smoke-marketplace` (`vscode-smoke-dry-run` in a dry run). The
  tag, the GitHub release and the npm packages exist by then, so a flaky failure is re-run
  (`gh run rerun <run-id> --failed`); otherwise fix the cause and ship it with the next release.

Never bump versions or edit `CHANGELOG.md` by hand. To validate packaging without releasing,
run the **Release** workflow manually with `dry_run` enabled; it smoke-tests the VSIX as well.

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
