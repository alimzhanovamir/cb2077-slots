# 010. Heartbeat and request timeout

- Status: Accepted
- Date: 2026-10-06

## Context

A WebSocket can die silently: a sleeping phone or a NAT/proxy dropping an idle connection may
produce no `close` event for minutes. The server would keep a ghost connection; the client
would wait for a spin response forever. Proxies also close idle connections after ~60s.

## Decision

- **Server**: every 15s it sends a WebSocket ping frame; browsers answer with pong
  automatically. A connection that did not answer since the previous ping is terminated.
- **Client**: browsers do not expose ping frames, so the client uses a request timeout. If a
  response does not arrive within 5s, the connection is considered dead: it is closed and
  the client reconnects (ADR 008) and recovers the pending spin (ADR 009).
- Before reconnecting the client discards the old connection and ignores anything that still
  arrives from it.
- In the in-browser emulator (ADR 012) there is no ping; the request timeout still applies.

## Considered options

- **Protocol ping on the server + request timeout on the client** — no extra messages. Chosen.
- **Application-level ping/pong messages** — detects dead connections while idle, but adds
  protocol messages; an idle client loses nothing by detecting the drop on its next request.
- **No heartbeat** — ghost connections and hanging spins.

## Consequences

- A debug latency above 5s deliberately triggers the timeout → reconnect → recovery path.
- An idle client notices a dead connection only on its next request.
