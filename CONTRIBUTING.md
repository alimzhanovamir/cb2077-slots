# Contributing

## Branches

- `main` is always releasable; every push to `main` deploys the demo to GitHub Pages.
- Work happens on short-lived branches named `<type>/<short-description>`,
  e.g. `feat/free-spins`, `fix/reconnect-timeout`, `docs/protocol-examples`.

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

A pull request is ready to merge when:

1. CI is green (`check` and `e2e`).
2. Tests cover the change (see [testing](docs/testing.md)).
3. Documentation is updated: protocol, math, rules or NFRs if they changed.
4. A changed architectural decision is recorded in an ADR: edited in place until the first
   release, a new superseding ADR after it (see [ADR conventions](docs/adr/README.md)).
5. `CHANGELOG.md` has an entry under `Unreleased` for user-visible changes, worded and approved
   by the project owner once they accept the work.

## Code style

Follow [code style](docs/code-style.md). Most of it is enforced: run `pnpm lint --fix` and
`pnpm format` before committing.

## Local checks

Git hooks run automatically after `pnpm install`:

- pre-commit — ESLint and Prettier on staged files;
- pre-push — unit tests.

Before opening a pull request, also run `pnpm typecheck` and `pnpm e2e`.
