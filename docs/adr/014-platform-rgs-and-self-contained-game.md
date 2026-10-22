# 014. Platform, RGS and a self-contained game

- Status: Accepted
- Date: 2026-10-21

## Context

A production slot is built in layers owned by different parts of a provider:

```
Operator (casino: wallet, accounts, lobby)
  └─ launches the provider's game by URL, often in an iframe
RGS (Remote Game Server): core (sessions, rounds, unfinished rounds, wallet calls)
                          + the game's math module (reel strips, paytable, win rules)
Game framework / wrapper ("platform"): the connection, round lifecycle, bets, money format,
                          jurisdiction rules, system windows in the provider's style
Game (presentation): its scene, reels, animations, the round presentation; it does not know
                          where it runs and talks to the platform through an "abstract game" API
```

The repository is built around one slot and should mirror that split. Before this decision
the layers drifted:

- the client's `GameController` drove the animation step by step (`startSpin` → `stopReels(grid)`
  → `showWins`) and the model kept the grid and the wins, so the platform knew how the game
  shows a round;
- the game's view showed system errors and drew the "connection lost" window;
- the RGS handlers called `randomGrid`/`evaluate` and read the paytable, so the RGS knew the
  243-ways rules;
- the protocol's `Round` mixed platform fields (bet, win, balance) and game fields (grid, wins)
  on one level, so every game feature would change the platform's types.

## Decision

**Packages** (ADR 002):

| Layer               | Package                                  | Owns                                                                                     |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Platform            | `apps/client` (`@cb2077/client`)         | HTML page, connection, round lifecycle, money and bets, money formatting, HTML system UI |
| Game (presentation) | `packages/game` (`@cb2077/game`)         | its own canvas, scene, reels, bottom panel, the whole round presentation, the Space key  |
| RGS core            | `packages/rgs` (`@cb2077/rgs`)           | sessions, rounds, balance, bet limits, debug commands; formerly `packages/engine`        |
| Game math           | `packages/math` (`@cb2077/math`)         | reel strips, paytable, 243 ways, debug presets                                           |
| Protocol            | `@cb2077/shared` + `@cb2077/shared/game` | the envelope and the game payload (ADR 005)                                              |

**Opaque game payload.** The protocol is split into an envelope and the game's payload:

- `Round = { roundId, seq, requestId, bet, totalWin, balance, forced?, outcome: unknown }`;
  `init` carries `config` (bets, currency) for the platform and `game: unknown` for the game.
- `@cb2077/shared/game` describes the payload (`SpinOutcome`, `GameInit`). Only the math, which
  produces it, and the game, which presents it, import it.
- The RGS and the platform forward the payload **without reading or validating it**. The owner
  validates it at its own boundary (`SpinOutcome.parse` in the game). Every byte from the
  network is still validated once: the envelope by the platform, the payload by the game.

Locks that keep the middle layers out of the payload:

1. the type `unknown`: `round.outcome.grid` does not compile;
2. ESLint bans importing `@cb2077/shared/game` in the platform and the RGS;
3. ESLint bans type assertions (`as`) where rounds pass through: the whole platform except
   `util/` and the emulator's storage in `net/demo/`, and the whole RGS (`as const` stays
   allowed);
4. contracts are written with function properties, not methods. TypeScript checks method
   parameters bivariantly, so with a method an implementation could declare
   `presentRound(outcome: SpinOutcome)` and skip validating its `unknown` input.
   `@typescript-eslint/method-signature-style: "property"` enforces this in the contract files;
5. ESLint bans relative paths into another package (`../../shared/src/game/…`), which would
   bypass lock 2, and bans the envelope's own files from importing the payload's.

Left to review, because a rule would cost more than it saves: a copy of the payload schema
written inside the platform, narrowing `unknown` by hand (`"grid" in outcome`) and a dynamic
`import("@cb2077/shared/game")`.

**Contracts checked by shape, not by import.**

- The platform defines `Game` (`apps/client/src/view/Game.ts`). The game imports nothing from
  the platform. `main.ts` writes `const game: Game = await createGame(…)`, so a missing or
  mistyped member fails `pnpm typecheck` there.
- The RGS defines `GameMath` (`packages/rgs/src/GameMath.ts`). The math imports nothing from the
  RGS. The composition roots (`apps/server`, `apps/client/src/net/demo`) pass `gameMath` to
  `GameServer`. The RGS checks at startup that every allowed bet is a multiple of the math's
  `betUnit`.
- Neither generic package depends on a game: dependencies point from the composition roots to
  both sides (dependency inversion), so there is no cycle.

**The boundary between the platform and the game:**

- The game owns the round presentation. The platform calls `startSpin()` when the player spins,
  then `presentRound(outcome, { totalWin })` and waits until it resolves, or `abortSpin()` when
  the spin failed or was not played. Its spin phases are only `idle → spinning → presenting`.
- The platform keeps the money (`bet`, `totalWin`, `balance`, `requestId`), the minimum spin
  time (a platform and jurisdiction rule), and the money formatter, which it hands to the game.
- System windows and notices (connecting, reconnecting, opened elsewhere, errors) are the
  platform's **HTML** over the game, in the platform's own style, not in the game's theme: the
  provider's cyberpunk look of a system menu, with its own palette and fonts, so the boundary
  between the two stays visible. The platform does not know what the game renders with or which
  fonts it uses: the game loads its own assets in `createGame` and sizes itself to the `host`
  element it is given.
- A blocking window stays while its state lasts and pauses the game (`pause()` / `resume()`):
  its animation and its own time stop, so a win show waits under the window. A notice does not
  block: it is the same panel as the window, closes itself after 5s (its dashes go out one by
  one, paused while the pointer is over it) or with its × button, and the same notice does not
  come back until it changes. A button of the platform clicked with the pointer gives the focus
  back to the page, so Space keeps spinning instead of pressing that button again.
- The game reports player actions through callbacks (`setActions`), not events: it needs no
  emitter and imports nothing.
- One connection, owned by the platform: the game never talks to the network.

## Considered options

- **Folders inside the client** — the cheapest option, but nothing stops the game from importing
  the platform, and it does not show the production split. Rejected.
- **A separate contract package (`game-api`)** — a neutral place for the contract, but one more
  package for a single type. The platform owns the contract, and structural typing makes an
  import unnecessary. Rejected.
- **The game imports the contract from the client** — this makes the game depend on the platform
  package, and the client also needs the game, so the packages form a cycle. Rejected.
- **The platform draws the whole UI and the game only the reels** — this suits a provider with
  a common UI bar. Here the game's look, including its bottom panel, is what the project shows.
  Rejected.
- **Pixi system windows inside the game's canvas** — this ties the platform to the game's
  renderer. Rejected in favour of HTML.
- **A multi-game repository with build-time game selection** — the repository is for one game.
  Rejected.
- **A flat `Round` with game fields on the envelope** — every game feature would change the
  platform and RGS types. Rejected.

## Consequences

- The game and its math can be read, changed and tested on their own. The RGS tests use a fake
  math that knows nothing about reels.
- A new game feature (free spins, cascades) changes only `@cb2077/shared/game`, the math and the
  game. The platform and the RGS stay the same.
- Validation of the game payload moves from the network boundary to the game. A payload the game
  cannot read is a technical error. For a round, the platform shows a system notice, the money
  counts as the server reported it, and a reload restores the last round. For `init.game`, or
  when the RGS refuses to start the session, the game cannot start: the platform shows a
  blocking window asking to reload.
- `apps/client` has no `pixi.js` and no game code. The `ws` build bundles neither the RGS nor the
  math.
- Autoplay was removed before the first release and returns as a platform dialog under the
  jurisdiction profile (see the roadmap).
- A game with other symbols or another grid would need its own payload schema and math; the
  platform and the RGS would not change.
