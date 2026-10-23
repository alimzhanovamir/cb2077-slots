# Contributing

## Branches

- `main` is protected: nothing is pushed to it directly, every change comes through a pull
  request. Only the `release` workflow pushes to it (see [Versions](#versions)).
- One task, one short-lived branch, one pull request. Branches are named
  `<type>/<short-description>`, e.g. `feat/free-spins`, `fix/reconnect-timeout`,
  `docs/protocol-examples`.
- Before pushing, bring the branch up to date with `main`: `git fetch` and
  `git rebase origin/main`. `main` accepts only up-to-date branches, so the checks run on exactly
  the code that lands, and merges follow each other no faster than CI.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>
```

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `style`.
- Scopes: `client`, `game`, `rgs`, `math`, `server`, `shared`, `e2e`, `docs`, `ci`.
- Summary in the imperative, lower case, no trailing period:
  `feat(client): add a free spins counter`.

## Pull requests

- The title follows the commit format above: it becomes the commit message on `main` (pull
  requests are squash-merged) and decides the next version. The `Pull request` workflow checks it.
- The description says what was done, why, and how it was checked; there is no separate issue
  tracker.

A pull request is ready to merge when:

1. The branch is up to date with `main`, and CI is green: `Lint, typecheck, test, build`,
   `E2E (ws)`, `E2E (demo)` and `Title and changelog`.
2. Tests cover the change (see [testing](docs/testing.md)).
3. Documentation is updated: protocol, math, rules or NFRs if they changed.
4. A changed architectural decision is recorded in an ADR: edited in place until the first
   release, a new superseding ADR after it (see [ADR conventions](docs/adr/README.md)).
5. A `feat`, `fix` or `perf` pull request adds its entry under `## [Unreleased]` in
   `CHANGELOG.md`, in English, worded and approved by the project owner (CI checks that it is
   there).

## Versions

One version for the whole repository, in the root `package.json`
([Semantic Versioning](https://semver.org/)). The workspace packages are private and stay at
`0.0.0`.

The version changes only when a pull request is merged. Right after the merge, the `release`
workflow works out the next version from the titles of the pull requests merged since the last
release (the strongest change wins: breaking, then `feat`, then `fix`/`perf`), commits it to
`main` as `chore(release): X.Y.Z` (with the `Unreleased` notes moved under the new version) and
tags it `vX.Y.Z`; the tag deploys the demo to GitHub Pages.

- CI does not run again on `main`: a branch must be up to date with `main` to be merged, so the
  merged code is exactly what CI checked in the pull request.
- If a release fails, the next merge, a re-run or a manual run releases everything merged since
  the last release (see [development](docs/development.md#releases)).
- A merge that releases nothing (`docs`, `ci`, …) leaves the demo on GitHub Pages as it is.
- The release commit moves `main` forward: open pull requests need **Update branch** (and a new
  CI run) before they can be merged.

| Pull request title                                 | Before | After |
| -------------------------------------------------- | ------ | ----- |
| `fix(game): …`, `perf: …`                          | 0.2.0  | 0.2.1 |
| `feat(client): …`                                  | 0.2.0  | 0.3.0 |
| `feat!: …` or a `BREAKING CHANGE:` note            | 0.2.0  | 0.3.0 |
| `docs`, `chore`, `ci`, `test`, `refactor`, `style` | 0.2.0  | —     |

- Before 1.0 a breaking change raises the minor part. 1.0.0, like any version set by hand in a
  pull request, is released as it is when that pull request is merged.
- No release artifacts are kept: a build only goes to GitHub Pages.
- The workflow pushes with a deploy key (`RELEASE_DEPLOY_KEY`, a secret of the `release`
  environment, given to jobs on `main` only), the only key allowed to bypass the protection of
  `main`. It uses no third-party actions; the logic is in `scripts/versioning.js`,
  covered by `scripts/versioning.test.js`.

## Code style

Follow [code style](docs/code-style.md). Most of it is enforced: run `pnpm lint --fix` and
`pnpm format` before committing.

## Local checks

Git hooks run automatically after `pnpm install`:

- pre-commit — ESLint and Prettier on staged files;
- pre-push — unit tests.

Before opening a pull request, also run `pnpm typecheck` and `pnpm e2e`.
