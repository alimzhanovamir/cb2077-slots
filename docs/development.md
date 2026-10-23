# Development

## Requirements

- Node.js 24 LTS (see `.nvmrc`; `nvm use` picks it up)
- pnpm 12+ (version pinned in `packageManager`; `corepack enable` installs it)

```sh
pnpm install
pnpm --filter @cb2077/e2e exec playwright install chromium webkit   # once, for E2E tests
```

To run one browser or one mode: `pnpm --filter @cb2077/e2e e2e:ws --project=chromium`,
`pnpm --filter @cb2077/e2e e2e:demo`.

## Scripts

| Command            | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `pnpm dev`         | Node.js server (`tsx watch`) + Vite client in `ws` mode                |
| `pnpm dev:demo`    | Vite client with the in-page emulator (Vite mode `demo`) — no server   |
| `pnpm test`        | Unit tests (Vitest) in all packages                                    |
| `pnpm lint`        | ESLint, including layer-boundary rules                                 |
| `pnpm typecheck`   | `tsc --noEmit` in every workspace                                      |
| `pnpm build`       | Production build of the client (`ws` mode)                             |
| `pnpm build:demo`  | Production build with the in-page emulator (`dist-demo`)               |
| `pnpm build:pages` | Production build for GitHub Pages (`demo` mode, `/cb2077-slots/` base) |
| `pnpm e2e`         | Playwright E2E tests in both transport modes (`e2e:ws`, `e2e:demo`)    |
| `pnpm format`      | Prettier over the repository                                           |

The client dev server listens on all interfaces, so the game can be opened from a phone on
the same network: `http://<your-computer-ip>:5173`.

## Environment variables

### Server (`apps/server/src/environment.ts`)

| Variable          | Default  | Meaning                                  |
| ----------------- | -------- | ---------------------------------------- |
| `PORT`            | `8080`   | WebSocket port                           |
| `START_BALANCE`   | `100000` | Starting balance of a new session, cents |
| `SESSION_TTL_MIN` | `30`     | Minutes a disconnected session is kept   |

### Client (Vite)

| Variable         | Default                                   | Meaning                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------ |
| `VITE_TRANSPORT` | `ws` (`demo` in modes `demo` and `pages`) | `ws` — Node.js server; `demo` — in-page emulator |
| `VITE_WS_URL`    | `ws://<page host>:8080`                   | WebSocket URL in `ws` mode                       |

## Dependencies

- pnpm runs dependency build scripts only when they are allowed in `pnpm-workspace.yaml`
  (`allowBuilds`, currently `esbuild`). A new dependency with an install script must be
  approved: `pnpm approve-builds`.
- pnpm's minimum release age policy stays on; a package newer than the policy is listed
  explicitly in `minimumReleaseAgeExclude`.
- CI installs with `pnpm install --frozen-lockfile`.

## Debug drawer

A slide-out drawer in plain DOM (not part of the canvas game). Click the **DEBUG** tab on the
right edge of the page. It is always available, works the same in both modes and sends `debug.*`
messages through the game's own connection (ADR 011). In `demo` mode they reach the RGS running
in the page, which answers exactly like the Node.js server.

- Its header shows the overrides the server confirmed (next outcome, next error, latency); an
  override that is on is highlighted. Next outcome and next error apply to one spin, and the
  server pushes them as cleared after that spin.
- The terminal at the bottom types each command (`> set NEXT OUTCOME "big win"`); the cursor
  blinks at its end until the command is confirmed. Then, like a shell, a new prompt follows,
  with the error in red above it if the command failed; the lines fade out after 3s. Requests
  are confirmed by the server's answer, "Drop connection" by the dropped connection, "Reset
  session" by the new session. With reduced motion the text appears without typing.
- A button clicked with the mouse gives the focus back to the page, so Space keeps spinning.
- The drawer is styled after the project's cyberpunk theme with its own palette and a monospace
  font; it uses nothing from the game.

- **Next outcome** — pick a preset (no win / small / big / max) for the next spin, or Random.
- **Next error** — make the next spin fail with an error code, or None.
- **Latency** — delay every spin response (3s, 6s, None); above 5s the client times out and
  reconnects.
- **Drop connection** — the server closes the connection; the client reconnects.
- **Reset balance** / **Set balance** — change the balance.
- **Reset session** — start over with a new session.

## Checks: git hooks and CI

Fast checks run on the developer machine, everything runs in CI, so nothing depends on
remembering to run it.

| Hook       | Runs                                                       |
| ---------- | ---------------------------------------------------------- |
| pre-commit | `lint-staged`: ESLint `--fix` and Prettier on staged files |
| pre-push   | `pnpm test` (unit tests)                                   |

- Type checking is not in pre-commit: it is slow on every commit, and CI catches it.
- E2E tests are not in pre-push: they take minutes across four browser projects.
- Hooks can be bypassed with `--no-verify`; CI is the final gate.

`.github/workflows/ci.yml` runs on pull requests only (`ubuntu-latest`, Node from `.nvmrc`, pnpm
store cache); a new push cancels the older run. It does not run on `main`: a branch must be up to
date with `main` to be merged, so the merged commit has exactly the files its pull request
checked. The pnpm store cache is therefore warmed per pull request (about 20–30s on its first
run).

- job `check`: `lint → typecheck → test → build`, also the `demo` and Pages builds;
- jobs `E2E (ws)` and `E2E (demo)` (in parallel, after `check`, at most 30 minutes): run in the
  official Playwright image (`mcr.microsoft.com/playwright`, browsers preinstalled; its tag must
  match the exact `@playwright/test` version in `e2e/package.json`), run the suite in their mode
  with one worker and doubled timeouts (no GPU on the runner: WebGL is rendered in software)
  and report failures as annotations on the pull request; traces and screenshots are uploaded
  when a test fails.

`main` is protected by a ruleset (Settings → Rules → Rulesets): no deletion, no force push, a pull
request with squash merging only, the three CI checks above and `Title and changelog` required, the
branch up to date with `main` ("Require branches to be up to date before merging"); only deploy keys
bypass it (see [Releases](#releases)). Settings → General → Pull Requests: squash merging only, the
default commit message is the pull request title. Releases rely on the up-to-date rule: after the
protection was lifted (e.g. to rewrite history), check `main` by hand before the next release.

GitHub Actions is free for public repositories; private repositories get 2,000 Linux minutes
per month on the Free plan.

## Deploy

`.github/workflows/pages.yml` publishes the demo (ADR 013) only for released versions, when the
`release` workflow pushes the tag `vX.Y.Z` (see [CONTRIBUTING](../CONTRIBUTING.md#versions)), or
by hand (Actions → Deploy to GitHub Pages → Run workflow): `pnpm install --frozen-lockfile` →
`pnpm build:pages` (in-page emulator, base `/cb2077-slots/`) → `actions/upload-pages-artifact` →
`actions/deploy-pages`. The game is served at `https://<owner>.github.io/cb2077-slots/`.

One-time setup:

- Settings → Pages → Source: **GitHub Actions**;
- Settings → Environments → `github-pages` → Deployment branches and tags: add the tag rule `v*`.

## Releases

`.github/workflows/release.yml` runs after every merge into `main` and releases the version that
the pull requests merged since the last release ask for (`scripts/release.js`).
`.github/workflows/pull-request.yml` checks the title and the CHANGELOG entry of every pull
request (`scripts/check-pull-request.js`). The rules are in
[CONTRIBUTING](../CONTRIBUTING.md#versions); `scripts/versioning.test.js` runs with `pnpm test`.

The version comes from the tags, so a release never depends on one run: any later run releases
whatever was merged since the last tag, and a run with nothing to release does nothing. The commit
and the tag are pushed together (`--atomic`). If a release failed:

- Actions → Release → the failed run → **Re-run failed jobs**; or
- Actions → Release → **Run workflow** (branch `main`).

Either checks out the latest `main`. The new tag then deploys GitHub Pages.

One-time setup of the release key (on your machine, then on GitHub). The key is a secret of the
`release` environment, so only jobs on `main` get it; pull request workflows and the Pages deploy
need no secrets.

1. `ssh-keygen -t ed25519 -f release_key -N "" -C "release workflow"` (no passphrase: the
   workflow cannot type it).
2. Settings → Environments → New environment `release`:
   - Deployment branches and tags: **Selected branches and tags** → add the branch rule `main`;
   - no required reviewers and no wait timer;
   - Environment secrets → `RELEASE_DEPLOY_KEY`: the contents of `release_key`.
3. Settings → Deploy keys → Add deploy key: the contents of `release_key.pub`, **Allow write
   access**.
4. Settings → Rules → the ruleset of `main` → Bypass list → add **Deploy keys**.
5. Delete `release_key` and `release_key.pub` from the disk.

Keep `RELEASE_DEPLOY_KEY` out of the repository secrets: those reach workflows on every branch. To
revoke the key, delete it in Settings → Deploy keys; releases stop until a new one is added. If a
release fails at checkout with `Permission denied (publickey)`, check the environment secret, the
key's write access and the environment's branch rule, then re-run it.
