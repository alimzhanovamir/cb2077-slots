# 009. Round ids and lost-response recovery

- Status: Accepted
- Date: 2026-10-06

## Context

A spin may be played on the server while its response is lost (the connection dropped after
the server committed the round). The client must then show the correct result and balance,
without double-charging and without complex machinery in the emulator.

## Decision

- The client generates a `requestId` for every request (`crypto.getRandomValues`, which works
  outside secure contexts, unlike `crypto.randomUUID`).
- The server assigns each round a `roundId` and a per-session sequence number `seq`.
- A round contains `roundId, seq, requestId, bet, totalWin, balance, forced?` and the game's
  `outcome` (the grid and the wins, opaque to the platform, ADR 014). `balance` is the balance
  after the round. Reel stops are not part of the contract.
- The session keeps the last 100 rounds.
- **Recovery**: after reconnecting, the client compares `lastRound.requestId` from `init` with
  its pending spin:
  - equal → the round was played; the client presents it;
  - different → the spin never reached the server; the client returns to `idle`.
    The client never re-sends a spin automatically.
- The server computes the whole round first and only then changes the balance, so an
  exception leaves the session unchanged.

## Considered options

- **Compare with `lastRound` on reconnect** — no extra server state. Chosen.
- **Idempotent re-send keyed by `requestId`** — robust, but needs an index and resend logic;
  overkill for an emulator with one in-flight spin.

## Consequences

- Correct balance after any drop, with a few lines of client code.
- Only the most recent spin can be recovered — enough, because the client allows one spin
  in flight.
