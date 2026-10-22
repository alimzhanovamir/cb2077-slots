# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

CB2077 — an HTML5 slot game (5×3, 243 ways, cyberpunk theme), split like a production slot
(ADR 014): a **platform** that runs a self-contained **game**, and an **RGS** emulator that owns
every outcome and hosts the game's **math**; the same RGS runs in the browser for GitHub Pages.
Start with [docs/README.md](docs/README.md); architecture rules are in
[docs/architecture/rules.md](docs/architecture/rules.md) and decisions in [docs/adr](docs/adr).
Apps live in `apps/`, libraries in `packages/`, E2E tests in `e2e/` (ADR 002); packages import
each other by name (`@cb2077/shared`).

| Folder            | Role                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `packages/shared` | zod schemas: the envelope (`@cb2077/shared`) and the game payload (`/game`)    |
| `packages/game`   | the game's presentation (PixiJS); imports nothing from the platform            |
| `packages/rgs`    | RGS core: sessions, rounds, handlers; platform-neutral; knows no game rules    |
| `packages/math`   | the game's math: strips, paytable, 243 ways, presets; imports nothing from rgs |
| `apps/server`     | Node.js WebSocket host for `rgs` + `math`                                      |
| `apps/client`     | the platform: `logic` / `view` / `net` / `app` / `debug` / `util`; no Pixi     |
| `e2e`             | Playwright, 5 browser projects × 2 transport modes (`ws`, `demo`)              |

## Commands (pnpm only — never npm)

```sh
pnpm install
pnpm dev            # server :8080 + client :5173
pnpm dev:demo       # client with the in-page emulator, no server
pnpm lint           # ESLint incl. layer boundaries and double quotes
pnpm typecheck
pnpm test           # Vitest (math, rgs, client)
pnpm build          # client, ws mode; also build:demo, build:pages
pnpm e2e            # both modes; or: pnpm --filter @cb2077/e2e e2e:ws --project=chromium
pnpm format
```

Run `pnpm lint && pnpm typecheck && pnpm test` after every change; run E2E after changes to
the client, the game, the protocol, the RGS or the math.

## Conventions

- **Language**: code, comments, UI strings, docs and commit messages in English. Talk to the
  user in Russian.
- **Style**: [docs/code-style.md](docs/code-style.md) — braces everywhere, blank lines around
  blocks, no `!`, `type` over `interface`, private methods before public, 100-char lines,
  double quotes.
- **Names**: full words — `connection`, `context`, `dependencies`, `environment`; no `conn`,
  `ctx`, `deps`, `env`, `rng`, `Ws…` and no single-letter names. External APIs keep their names.
  File names say what a module does and never contain `cb2077` (`gameMath.ts`).
- **Types**: schema-first in `shared`; validate only at boundaries; branded ids and `Cents`;
  `as const` instead of `enum`.
- **Money**: integer cents only; formatting only in `apps/client/src/view/format/money.ts`
  (the platform hands the game a formatter). `balance` is always the current balance; a previous
  one is `prevBalance`.
- **Layers**: `logic` never imports `view`/`net`; `view` never imports `logic`/`net`; only
  `app/GameController` wires them. Only `main.ts` imports `@cb2077/game`; only
  `apps/client/src/net/demo` imports `rgs` and `math`. ESLint enforces this — do not disable
  the rules.
- **Game payload is opaque** (ADR 014): `Round.outcome` and `init.game` are `unknown` to the
  platform and the RGS — never import `@cb2077/shared/game` there and never cast it; the game and
  the math validate it. Contracts (`apps/client/src/view/Game.ts`,
  `packages/rgs/src/GameMath.ts`) use function properties; the game and the math match them by
  shape, never by import.
- **The game owns the presentation**: the platform calls `startSpin` / `presentRound` /
  `abortSpin` and never drives reels or wins itself. System windows are the platform's HTML.
- **RGS stays simple**: it is an emulator. No RTP simulators, idempotency machinery or
  real-backend protections unless the user asks.
- UI texts live in `texts.ts`: the platform's in `apps/client/src/view/texts.ts`, the game's in
  `packages/game/src/texts.ts`; animation timings in `packages/game/src/theme.ts`.

## Workflow

- Do not commit, push or create branches unless the user asks.
- ADRs: until the first release, edit the existing ADR in place (decision, reasons, considered
  options); after it, a changed decision gets a new ADR that supersedes the old one (see
  [docs/adr/README.md](docs/adr/README.md)). Keep `docs/` in sync with the code.
- `CHANGELOG.md`: never write to it on your own. An entry marks that the owner accepts the work,
  so propose the wording and wait for the owner's approval first.
- Discuss and agree on plans before large changes; do not re-litigate agreed decisions.

## Environment notes

- Playwright's Firefox does not start on this Mac (macOS 27); run local E2E without the
  `firefox` project. CI on Ubuntu runs all five projects.
- In the sandboxed shell, set a short `TMPDIR` for E2E (e.g. `TMPDIR=/tmp/claude-501/pw`);
  long temp paths break `tsx`'s IPC socket.
- The in-page emulator mode is `demo` everywhere: transport, Vite mode, scripts, E2E mode
  and folder (ADR 012).
