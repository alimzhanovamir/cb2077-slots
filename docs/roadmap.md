# Roadmap

## MVP (current)

- Node.js server emulator and in-browser emulator sharing one RGS and one math module.
- Platform, RGS, math and game as separate packages behind contracts (ADR 014).
- 5×3, 243 ways, regular symbols, placeholder graphics.
- Spin, bet − / + with a selectable step.
- Sessions, reconnect, tab takeover, debug drawer.
- Unit and E2E tests, CI, git hooks, GitHub Pages deploy, documentation.

## Next

1. **Art, effects, sound** — symbols, background, neon/glitch filters, win celebrations, audio;
   the game's fonts bundled with the game instead of Google Fonts.
2. **Wild and Scatter** — Wild substitutes regular symbols in ways; Scatter pays anywhere.
3. **Free spins** — triggered by 3+ Scatters, with a multiplier.
4. **Turbo** — faster animation timings (the game's timings are already one settings object in
   `packages/game/src/theme.ts`); allowed or not per jurisdiction.
5. **Mobile controls layout** — design mock-ups, then a dedicated portrait layout.
6. **Paytable screen and round history**.
7. **Hosted Node.js server** (optional) — real network behaviour over `wss://`.
8. **Jurisdictions (compliance)** — a jurisdiction profile in the platform config, selected at
   launch: minimum game-cycle time, whether autoplay is allowed and its mandatory limits, turbo
   and quick stop, maximum bet, celebrating wins that do not exceed the stake, net position and
   session clock, reality checks. Starts with `default` (current behaviour) plus examples
   modelled on the UK and Germany; the exact rules come from the regulators' current documents
   at implementation time. Only the flags that change the presentation reach the game.
9. **Autoplay** — a platform dialog (HTML) with a spin count and stop conditions (error,
   insufficient funds, connection lost, single win ≥ limit, loss ≥ limit), governed by the
   jurisdiction profile. Removed before the first release to keep it focused on the game.
