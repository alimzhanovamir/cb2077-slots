# Testing

## Levels

| Level  | Tool                   | Where                                          | Runs in          |
| ------ | ---------------------- | ---------------------------------------------- | ---------------- |
| Unit   | Vitest                 | `packages/{math,rgs}/test`, `apps/client/test` | pre-push, CI     |
| E2E    | Playwright             | `e2e/tests`                                    | CI, `pnpm e2e`   |
| Manual | Browser + debug drawer | —                                              | Before a release |

## Unit tests

**math**

- `evaluate`: hand-made grids, including the documented example (katana × 3 reels,
  2 ways); no win when a symbol skips a reel; 4- and 5-reel wins; payout is an integer for
  every bet that is a multiple of `coinsPerBet`.
- Every preset in `presets.json` produces the documented outcome.
- `spin` with a deterministic `Random` returns the expected grid.
- `gameMath` (the `GameMath` implementation): new state, `gameInit`, rejecting a foreign
  state, playing a preset, the preset list.

**rgs**

- Bet validation: min, max, granularity, insufficient funds; the bet config.
- Sessions: create, resume, takeover sends `sessionReplaced`, expiry only after disconnect,
  round history capped at 100.
- Handlers through a fake `Connection`: `init`, `spin`, every `debug.*`, `BAD_REQUEST` on
  invalid input, session unchanged after an exception.
- A fake `GameMath` that knows nothing about reels: the RGS forwards its outcome and game init
  unread, and refuses to start when the bets do not fit the math's bet unit.

**client**

- Bet rules: − / + with each step, clamping to min/max.
- Spin state machine: every transition in the
  [state diagram](architecture/overview.md#platform-state), including error and reconnect
  paths, pending-spin recovery, a failed presentation and a failed start. The fixtures use an
  opaque outcome: the platform never reads it.
- `GameClient` against a real RGS with the CB2077 math over an in-process transport, and with a
  math that rejects the session's state (`init` answered with an error, no retry).

## E2E: driving a canvas game

The game is rendered on a canvas (ADR 003), so its buttons are not DOM elements and cannot be
found with selectors. The platform's system windows are HTML (ADR 014) and are found by
`data-testid` (`system-overlay`, `system-action`, `system-notice`, `system-notice-close`).

- Playwright in the `e2e` workspace, four projects: `chromium`, `webkit` (Safari),
  `mobile-chrome` (Pixel) and `mobile-safari` (iPhone): both engines, mouse and touch.
- The client exposes a read-only test hook `window.__slot`, created in
  `apps/client/src/app/testHook.ts`:
  - `getState()` → `{ phase, connection, balance, bet, step, lastWin, message, grid }`; `grid`
    is what the game reports (`getVisibleGrid`), passed through unread;
  - `getBounds(id)` → the on-screen rectangle of a game control (`spin`, `betUp`, `betDown`,
    `step`), reported by the game. Tests click or tap at those coordinates, so the real input
    path is exercised.
- Outcomes are made deterministic through the debug drawer (ADR 011), which is plain DOM and is
  driven by `data-testid` selectors. Tests never open their own WebSocket: it would take over the
  game's session (ADR 008).
- The suite runs in both transport modes (ADR 012), `ws` and `demo`; the second-tab scenario
  runs only in `ws`.

Why this approach:

- **Screenshot comparison** — rejected: brittle with animations and font rendering.
- **Calling game methods directly from tests** — rejected: skips the input path.

Limits:

- Firefox is not tested: the suite covers the two engines that matter for the target players
  (Chromium, WebKit), which keeps CI fast. Firefox is checked by hand before a release.
- Mobile projects are device emulation in the Chromium and WebKit engines (screen size, touch,
  user agent), not real phones.
- Playwright WebKit and device emulation are not real Safari or real phones; a manual check on a
  real device is still required (NFR-07).
- Headless browsers render WebGL in software: fine for behaviour, meaningless for frame rate.
- The test hook ships in production builds — harmless, it is read-only.

## E2E scenarios

Run in four projects and two modes (`ws`, `demo`); in CI the two modes are parallel jobs.

| #   | Scenario                                                                | Modes    |
| --- | ----------------------------------------------------------------------- | -------- |
| 1   | Load → `idle`, starting balance shown                                   | ws, demo |
| 2   | Spin with `noWin` and `bigWin` presets → expected balance               | ws, demo |
| 3   | Change step, − / + clamp to min/max, bet above balance → Spin disabled  | ws, demo |
| 4   | Drop connection during a spin → reconnect → same round, correct balance | ws, demo |
| 5   | Reload → same balance and grid                                          | ws, demo |
| 6   | Second tab → first tab `replaced`, "Play here" takes the session back   | ws       |
| 7   | Error notice → closes with ×; the next one closes by itself after 5s    | ws, demo |
| 8   | Space spins after clicking buttons in the debug drawer                  | ws, demo |

## Manual checklist

Use `pnpm dev` and the debug drawer.

- [ ] Spin, bet − / +, step cycling, Space key
- [ ] Every preset; win highlight and total
- [ ] Drop connection during a big win: the WIN field keeps the win, the win show waits under
      the "Reconnecting…" window and finishes after it
- [ ] Each error code via "Next error"; insufficient funds
- [ ] A notice closes after 5s (its dashes go out, pause under the pointer) and with ×; it does
      not come back on the next bet change
- [ ] Space spins after clicking buttons in the debug drawer
- [ ] Latency 3s (spin waits) and 6s (timeout → reconnect → round recovered)
- [ ] Drop connection while idle and while spinning
- [ ] Reload during a spin
- [ ] Second tab → "Game opened in another window" → "Play here"
- [ ] Reset balance, set balance during a spin (applied after the round), reset session
- [ ] Restart the server, or "Reset session" in the debug drawer → "Session reset"
- [ ] Phone on the local network: layout, touch, rotation
- [ ] `pnpm dev:demo`: the same checks except the second tab
