# 002. Monorepo with pnpm workspaces

- Status: Accepted
- Date: 2026-10-11

## Context

The project has several parts that share code: the protocol schemas are used by both the
client and the server, and the RGS with the game's math runs in two hosts — the Node.js server
and the in-browser emulator (ADR 012). The platform and the game are separate packages
(ADR 014). They should be versioned and changed together, and the
repository should make it obvious what is deployed and what is reused.

## Decision

### Tooling

- One repository with **pnpm workspaces**. The pnpm version is pinned in `packageManager`
  (`corepack enable` installs it); the Node.js version is pinned in `.nvmrc` (Node 24 LTS).
- Internal dependencies use the workspace protocol: `"@cb2077/shared": "workspace:*"`.
  Packages import each other by name only; a relative path into another package would bypass
  the package boundaries, and ESLint rejects it.
- The libraries in `packages/` are consumed as TypeScript sources (`exports` → `src/index.ts`);
  Vite and `tsx` compile them directly, `tsc --noEmit` type-checks every workspace.
- Lockfile: `pnpm-lock.yaml`; dependency settings are described in
  [development](../development.md#dependencies).
- Root scripts address packages by name, never by path: `pnpm --filter @cb2077/client build`,
  `pnpm -r --if-present test`.

### Layout

A workspace that other workspaces **import** goes to `packages/`. A workspace that has its own
entry point, is **run or deployed** and is imported by no one goes to `apps/`. Being optional
does not turn an app into a library. The E2E suite tests the whole system and is neither, so it
stays in the root.

| Folder            | Package          | Contents                                                               | Depends on                                                 |
| ----------------- | ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/client`     | `@cb2077/client` | The platform: page, network, round lifecycle, HTML system UI           | `shared`, `game` (`main.ts`), `rgs` + `math` (`net/demo/`) |
| `apps/server`     | `@cb2077/server` | Node.js WebSocket server hosting the RGS with the game's math          | `rgs`, `math`, `shared`                                    |
| `packages/shared` | `@cb2077/shared` | zod schemas: the envelope (`.`) and the game payload (`./game`)        | —                                                          |
| `packages/game`   | `@cb2077/game`   | The game's presentation (PixiJS): scene, reels, bottom panel, win show | `shared/game`                                              |
| `packages/rgs`    | `@cb2077/rgs`    | RGS core: sessions, rounds, balance, bet limits, handlers, debug       | `shared`                                                   |
| `packages/math`   | `@cb2077/math`   | The game's math: reel strips, paytable, 243 ways, presets              | `shared`, `shared/game`                                    |
| `e2e`             | `@cb2077/e2e`    | Playwright tests                                                       | —                                                          |

Neither `client` nor `rgs` depends on a game by its own code: the game and the math match their
contracts by shape, and the composition roots wire them in (ADR 014).

`pnpm-workspace.yaml` lists `apps/*`, `packages/*` and `e2e`.

### Runtime configurations

Each configuration consists of apps only; the libraries are reused by both:

- `ws`: `apps/client` (ws build) + `apps/server`, which hosts `rgs` with `math` in Node.js;
- `demo` and GitHub Pages: `apps/client` alone, which hosts `rgs` with `math` in the page
  through `net/demo` (ADR 012, ADR 013).

## Considered options

Tooling:

- **pnpm workspaces** — strict isolation catches undeclared imports, a content-addressed store
  makes installs fast, build scripts need explicit approval. Chosen.
- **npm workspaces** — built into npm, no extra tool. Rejected: the flat `node_modules` lets a
  package import dependencies it never declared.
- **Yarn (Berry) workspaces** — similar guarantees to pnpm, but Plug'n'Play needs extra editor
  and tool configuration.
- **Turborepo / Nx** — task caching and orchestration are overkill for a handful of small packages.
- **Separate repositories** — protocol changes would need coordinated releases.

Layout:

- **`apps/` + `packages/`, `e2e/` in the root** — the common pnpm monorepo convention; the
  folder tells whether something is deployed or reused. Chosen.
- **Everything in the root** — shortest paths, but packages mix with docs and configs, and the
  root grows with every new package.
- **Everything in `packages/`** — one folder, but applications and libraries look the same.
- **`server` in `packages/`** — because the game also runs without it. Rejected: nothing
  imports `server`; it is an optional app. If another host ever needs the WebSocket adapter,
  `GameWebSocketServer` moves to a library in `packages/` and `apps/server` keeps only the
  entry point.

## Consequences

- One `pnpm install`, one CI pipeline, atomic changes across client and server.
- Client and server are always deployed from the same commit, so the protocol needs no
  versioning (see [limitations](../limitations.md)).
- No build step for internal packages; they must stay free of features that Vite or `tsx`
  cannot compile on the fly.
- Contributors need pnpm (`corepack enable`). A package that imports something it does not
  declare fails to resolve, so dependency lists stay honest; dependency build scripts need
  explicit approval.
- A new application goes to `apps/`, a new shared library to `packages/`;
  `pnpm-workspace.yaml` picks them up without changes. Moving a package between the two
  folders changes paths in configs and docs, never imports.
