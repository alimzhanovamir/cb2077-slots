# 012. Transport-agnostic RGS and demo mode

- Status: Accepted
- Date: 2026-10-06

## Context

The game should be playable on static hosting (GitHub Pages, ADR 013), where no Node.js
server can run. The server logic is small and needs no Node.js APIs, so it can run in the
browser — if it does not depend on how messages arrive.

## Decision

- All game-server logic lives in the `rgs` package (the RGS core) and the `math` package (the
  game's rules, ADR 014): pure TypeScript, no Node.js APIs, no DOM. Randomness comes from
  `crypto.getRandomValues`, available in Node 24 and browsers.
- `rgs` talks to an abstract `Connection` (`send`, `close`); `GameServer.connect(connection)`
  returns `{ onMessage(raw), onClose() }`. Sessions go through a `SessionStore` interface.
- **Node.js server** (`server`): wraps each WebSocket into a `Connection`, adds ping/pong,
  uses `MemorySessionStore`.
- **Demo mode** (`apps/client/src/net/demo`): `DemoTransport` runs `rgs` with `math`
  inside the page as an in-page emulator, uses `LocalStorageSessionStore`.
- The client talks to a `Transport` interface; `GameClient`, `logic`, `view` and `app` do not
  know which one is active. The build variable `VITE_TRANSPORT=ws|demo` selects it; the
  Vite modes `demo` (`pnpm dev:demo`) and `pages` default it to `demo`. The
  demo transport is loaded with dynamic `import()`, so neither `rgs` nor `math` is bundled in
  `ws` builds.
- The mode is named "demo" after its purpose: a playable demo without a server. "local"
  suggested running on the developer's machine and "serverless" suggested FaaS. One name is
  used everywhere: transport, Vite mode, scripts, E2E mode and folder.
- The `ws` mode remains the main one: it exercises the real network path (WebSocket,
  heartbeat, real drops), shows the frames in the browser's DevTools, supports tab takeover
  and keeps the outcome out of the client's reach.
- In demo mode messages are still serialised to JSON and validated by the same schemas, and
  responses are asynchronous. `debug.dropConnection` triggers `onClose`, so the client runs
  its real reconnect logic.

## Considered options

- **Shared RGS and math, two transports** — one implementation of the rules, same protocol in
  both modes. Chosen.
- **Separate fake backend for static builds** — two implementations drift apart.
- **Run the RGS in a Web Worker** — closer to a separate process, but more plumbing for
  no practical gain at this stage.

## Consequences

- The playable demo needs no server; development without a server is possible
  (`pnpm dev:demo`).
- `rgs` and `math` code must stay platform-neutral (enforced by their tsconfig `lib` and ESLint).
- In demo mode the "server" runs in the page and can be tampered with from the console, and
  tab takeover is not emulated (see [limitations](../limitations.md)).
