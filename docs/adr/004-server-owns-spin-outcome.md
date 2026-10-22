# 004. The server owns the spin outcome

- Status: Accepted
- Date: 2026-10-06

## Context

In real slot games the client never decides the outcome: the game server draws random
numbers, evaluates wins and updates the wallet; the client only presents the result. The
project emulates this model so that the client is built the same way as a production one.

## Decision

- The server (the RGS in `rgs` with the game's math in `math`, ADR 014) draws random reel
  stops, builds the grid, evaluates wins and updates the balance. It returns the finished round.
- The client sends only the intent (`spin { bet }`) and animates the result it receives.
  It never computes wins or balances.
- The server is a simple emulator: random stops + paytable evaluation. No RTP certification,
  no anti-tampering, no regulatory features.

## Considered options

- **Server-authoritative outcome** — matches production architecture. Chosen.
- **Client-side outcome** — simpler, but the client would not be representative of a real
  slot client and could not be connected to a real backend later.

## Consequences

- The client can be pointed at another backend that speaks the same protocol.
- The client must handle latency, errors and lost responses (ADR 009, ADR 010).
- Reel strips and the paytable stay on the server; the game draws random filler symbols
  while spinning.
