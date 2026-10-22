# CB2077

An HTML5 slot game with a cyberpunk theme: 5×3 reels, 243 ways, bet steps and a
developer debug drawer. Built with TypeScript and PixiJS.

The game talks to a **backend emulator** that owns every outcome, like a real slot server.
The same RGS and math run either as a Node.js WebSocket server or inside the browser, so the game
can be hosted on GitHub Pages without a backend.

> MVP: placeholder graphics, regular symbols only. See the [roadmap](docs/roadmap.md).

## Quick start

```sh
nvm use        # Node 24
pnpm install
pnpm dev       # server on :8080 + client on http://localhost:5173
pnpm dev:demo  # client only, the RGS runs in the page
```

Open the **DEBUG** tab on the right to force outcomes, errors, latency, a dropped connection
or a new balance.

## Repository

The layers mirror a production slot (ADR 014): a platform that runs a self-contained game, and
an RGS that hosts the game's math.

| Folder            | What it is                                                               |
| ----------------- | ------------------------------------------------------------------------ |
| `apps/client`     | The platform: page, network, round lifecycle, HTML system windows        |
| `packages/game`   | The game's presentation in PixiJS: scene, reels, bottom panel, win show  |
| `packages/rgs`    | RGS core: sessions, rounds, balance, bet limits, message handling, debug |
| `packages/math`   | The game's math: reel strips, paytable, 243 ways, debug presets          |
| `packages/shared` | Protocol contract: the envelope and the game payload as zod schemas      |
| `apps/server`     | Node.js WebSocket server hosting the RGS with the math                   |
| `e2e`             | Playwright tests in Chromium and WebKit, desktop and mobile emulation    |
| `docs`            | Architecture, ADRs, NFRs, protocol, math, testing                        |

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm e2e
```

Git hooks run ESLint/Prettier on commit and unit tests on push; GitHub Actions runs everything
on every push and deploys `main` to GitHub Pages.

## Documentation

Start with [docs/README.md](docs/README.md): architecture overview, rules, ADRs, protocol and
game math.
