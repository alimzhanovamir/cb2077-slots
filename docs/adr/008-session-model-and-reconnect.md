# 008. Session model and reconnect

- Status: Accepted
- Date: 2026-10-06

## Context

WebSocket connections drop all the time: mobile devices sleep, networks switch, pages are
reloaded. If the balance lived on the connection, every drop would reset the game.

## Decision

- A **session** is the player on the server (balance, rounds, debug state). A connection is
  a temporary channel to a session.
- Sessions are stored through a `SessionStore` interface: an in-memory `Map` on the Node.js
  server, `localStorage` in the in-browser emulator (ADR 012).
- **Creation**: `init` without a `sessionId`, or with an unknown one, creates a session with
  the starting balance. The client stores the returned `sessionId` in `localStorage`. The
  `resumed` flag tells the client whether an existing session was restored.
- **Reconnect**: after a drop or a reload the client reconnects with backoff
  (0.5s → 1s → 2s → 4s → 8s, capped at 10s) and sends `init { sessionId }`. The server returns
  the balance, the last round and the game's part of `init` (`init.game`, with the grid to
  show).
- **One connection per session**: a new connection takes over the session; the previous one
  receives `sessionReplaced` and is closed. The replaced tab shows "Game opened in another
  window" with a "Play here" button and does **not** reconnect by itself — otherwise two tabs
  would keep taking the session from each other.
- **Expiry**: a session is deleted 30 minutes after its last connection closed. A connected
  session never expires.
- **Reset**: the debug drawer can reset the session (client forgets the `sessionId` and
  sends `init` without it).

## Considered options

- **Session separate from connection** — survives drops and reloads. Chosen.
- **Session per connection** — balance lost on every drop.
- **`sessionStorage` (session per tab)** — no tab conflicts, but closing the tab loses the
  game, and it does not match how real slots behave.

## Consequences

- Restarting the Node.js server loses all sessions; the client shows "Session reset" and
  starts a new one (see [limitations](../limitations.md)).
- Only one tab can play at a time — by design.
