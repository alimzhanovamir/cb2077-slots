# 006. Client layering: logic / view / controller

- Status: Accepted
- Date: 2026-10-06

## Context

The platform's logic (spin phases, bet rules) and the presentation (placeholder graphics
now, real art later) will change independently. A change in one must not force changes in the
other. The presentation itself is the game package (ADR 014); this record covers the platform
in `apps/client`.

## Decision

The client (the platform) is split into layers with strict dependency rules:

| Layer    | Responsibility                                                                        | May import                                       |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `logic/` | Platform state: connection, spin phases, balance, bet rules. Commands in, events out. | `shared`                                         |
| `view/`  | The game contract (`Game.ts`), the HTML system layer, money formatting, texts.        | `shared`                                         |
| `net/`   | Transport, request/response, reconnect.                                               | `shared`; `rgs` and `math` only from `net/demo/` |
| `app/`   | `GameController` wires logic, the game, the system layer and net; the test hook.      | everything above                                 |
| `debug/` | Developer debug drawer (plain DOM).                                                   | `shared`, `net`                                  |
| `util/`  | Shared helpers: event emitter, safe `localStorage`, `wait`, error log, focus release. | nothing; every layer may import it               |

- `logic` knows nothing about rendering or the network; `view` knows nothing about rules or the
  network. Only `app/GameController` knows all of them.
- Only `main.ts` imports the game (`@cb2077/game`). No layer imports `pixi.js` or the game's
  payload schemas (ADR 014).
- The boundaries are enforced by ESLint `no-restricted-imports`.

## Considered options

- **Layers with a single controller** — explicit, testable, no framework. Chosen.
- **Classic MVC with views calling models directly** — views become coupled to logic.
- **Global store (Redux-like) read by everyone** — hides dependencies, extra library.

## Consequences

- `logic` is unit-tested without a browser or canvas.
- Placeholder graphics can be replaced without touching the platform (NFR-06): they live in the
  game package.
- The controller grows as features are added; it must stay a thin wiring layer.
