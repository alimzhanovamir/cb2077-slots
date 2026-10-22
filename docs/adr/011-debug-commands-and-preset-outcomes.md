# 011. Debug commands and preset outcomes

- Status: Accepted
- Date: 2026-10-06

## Context

Many client states are rare with random outcomes: big wins, errors, slow responses, dropped
connections, insufficient funds. Developers and E2E tests need to trigger them on demand.

## Decision

- **Debug commands are part of the protocol**: `debug.*` messages go through the normal client
  connection, in every build and in both modes (Node.js server and in-browser emulator). There
  is no separate admin channel. The developer UI for them is the debug drawer (see
  [development](../development.md#debug-drawer)).
- Commands: force the outcome of the next spin, make the next spin fail with an error code,
  set the response latency, drop the connection, reset or set the balance.
- **Forced outcomes are preset grids**, not searches: the next spin uses a grid from the
  math's `presets.json` (`packages/math`) instead of a random one, evaluates it with the normal
  `evaluate` and marks the round as `forced`. The RGS only passes the preset id to the math
  (`GameMath.play`), checks it with `hasPreset` and lists the presets in `init.debug` (ADR 014).
  New presets are added by editing JSON.
- **Debug state lives in the session**: `forceNext` and `failNext` apply to one spin,
  `latencyMs` stays until changed. `failNext` returns the error without charging the bet.
  The server confirms every change (`debug.state`, `init.debug`), including the reset of a
  one-shot override by the spin that used it (a `debug.state` push).

## Considered options

- **Preset grids** — instant and deterministic. Chosen.
- **Search random spins until the outcome matches** — slow, non-deterministic, needs tuning.
- **Separate generous math profile** — cannot produce a specific state on demand.

## Consequences

- E2E tests are deterministic: they select a preset, spin, and know the expected balance.
- Preset grids may be impossible on the real reel strips — acceptable for testing, and the
  reason reel stops are not part of the round contract.
- Anyone can send debug commands — acceptable for a play-money emulator.
