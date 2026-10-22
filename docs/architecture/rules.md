# Architecture rules

These rules are mandatory. Rules marked **(lint)** are enforced by ESLint and fail CI.
Changing a rule requires an ADR.

## 1. Package and layer dependencies

| Code in                   | May import                                     | Must not import                                                                    |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `shared`                  | `zod`                                          | any other package **(lint)**                                                       |
| `game`                    | `@cb2077/shared/game`, `pixi.js`, `zod`        | `@cb2077/shared` (the envelope), `client`, `rgs`, `math`, `server` **(lint)**      |
| `rgs`                     | `@cb2077/shared`                               | `@cb2077/shared/game`, `math`, `game`, `client`, `server`, Node.js, DOM **(lint)** |
| `math`                    | `@cb2077/shared`, `@cb2077/shared/game`, `zod` | `rgs`, `game`, `client`, `server`, Node.js, DOM **(lint)**                         |
| `server`                  | `rgs`, `math`, `shared`, Node.js, `ws`         | `client`, `game`, `@cb2077/shared/game` **(lint)**                                 |
| `apps/client/src/main.ts` | `game` and everything in `client`              | `rgs`, `math`, `@cb2077/shared/game`, `pixi.js` **(lint)**                         |
| `apps/client/src/logic`   | `shared`                                       | `view`, `net`, `app`, `debug`, the packages below **(lint)**                       |
| `apps/client/src/view`    | `shared`                                       | `logic`, `net`, `app`, `debug`, the packages below **(lint)**                      |
| `apps/client/src/net`     | `shared`; `rgs`, `math` only from `net/demo/`  | `logic`, `view`, `app`, the packages below **(lint)**                              |
| `apps/client/src/debug`   | `shared`, `net`                                | `logic`, `view`, the packages below **(lint)**                                     |
| `apps/client/src/app`     | everything in `client`, `shared`               | the packages below **(lint)**                                                      |
| `apps/client/src/util`    | nothing (any layer may import it)              | every other layer, the packages below **(lint)**                                   |

"The packages below" for every client layer: `game` (only `main.ts` starts it),
`@cb2077/shared/game` (the game's payload is opaque to the platform) and `pixi.js` (the
platform's UI is HTML); `rgs` and `math` everywhere except `net/demo/` (ADR 012, ADR 014).

Packages import each other by name (`@cb2077/…`), never by a relative path into another
package **(lint)**. Inside `shared`, the envelope does not import the game payload **(lint)**.

`app/GameController` is the only place that knows `logic`, the game, the system layer and `net`
together. The game and the math match their contracts by shape (`view/Game.ts`,
`rgs/src/GameMath.ts`); contract members are function properties **(lint)**.

## 2. Types and validation (ADR 005)

- zod schemas in `packages/shared/src` are the single source of truth; types are inferred with
  `z.infer`. Do not hand-write a type that duplicates a schema.
- `shared` contains only the wire contract: the envelope (`src/schemas`, `@cb2077/shared`) and
  the game payload (`src/game`, `@cb2077/shared/game`). Server-internal models (session, game
  state, reel strips, paytable) live in `rgs` and `math`; client models live in `client`.
- Validate only at boundaries: incoming messages (both directions), JSON config files and
  environment variables at startup. Inside the application, trust the types.
- The game payload (`Round.outcome`, `init.game`) is `unknown` to the platform and the RGS: they
  pass it on without reading or validating it. Its owners validate it at their own boundary:
  the game in `show` and `presentRound`, the math in `gameInit` and for the stored state
  (ADR 014).
- No type assertions (`as`) where rounds pass through: all of `apps/client/src` except `util/`
  and `net/demo/`, and all of `packages/rgs/src` **(lint)**; `as const` is allowed. Check a
  value with its schema (`RequestId.parse`) or narrow it instead.
- Ids and money are branded types (`SessionId`, `RoundId`, `RequestId`, `Cents`).
- Use discriminated unions on `type` for messages and on `phase` for state.
- Use `as const` objects instead of TypeScript `enum`.

## 3. Money (ADR 007)

- Every amount is integer cents (`Cents`). No floating-point money anywhere.
- Only `apps/client/src/view/format/money.ts` converts cents to a display string. The platform
  hands the game a formatter; the game formats no money itself.
- The client never computes wins; it displays what the server returns. The only client-side
  money arithmetic is showing `balance − bet` while a spin is in flight.
- `balance` always means the current balance (in a `Round`: the balance after that round).
  A previous value is named `prevBalance`.

## 4. Naming

| Kind                   | Convention                              | Example                   |
| ---------------------- | --------------------------------------- | ------------------------- |
| Files with a class     | `PascalCase.ts`                         | `GameController.ts`       |
| Other modules          | `camelCase.ts`                          | `evaluate.ts`, `money.ts` |
| Types, classes         | `PascalCase`                            | `Round`, `SessionManager` |
| Functions, variables   | `camelCase`                             | `randomGrid`              |
| Constants              | `UPPER_SNAKE_CASE` for true constants   | `MIN_SPIN_MS`             |
| Protocol message types | `lowerCamel`, `debug.` prefix for debug | `spin`, `debug.forceNext` |
| Error codes            | `UPPER_SNAKE_CASE`                      | `INSUFFICIENT_FUNDS`      |

File names say what a module does and never contain the project's name (`cb2077`): the
repository and the `@cb2077` scope already carry it (`gameMath.ts`, not `cb2077Math.ts`).

Code, comments, UI texts and documentation are in English. Seconds are written without a space
(`3s`), or as a word (`3 seconds`). UI texts live in `texts.ts`: the
platform's in `apps/client/src/view/texts.ts`, the game's in `packages/game/src/texts.ts`.

## 5. Code style

Formatting, blank lines, expressions, types, class member order and imports are described in
[code style](../code-style.md).

## 6. Tests

- Unit tests sit next to the package in `test/` and are named `*.test.ts` (Vitest).
- `rgs` is tested without network or timers where possible, through a fake `Connection`, with
  the real math and with a fake `GameMath` that knows nothing about reels.
- `math` is tested on its own, with a deterministic `Random`.
- `apps/client/src/logic` is tested without a browser; its fixtures use an opaque outcome.
- E2E tests live in `e2e/tests` and use only the test hook and the debug drawer (see
  [testing](../testing.md#e2e-driving-a-canvas-game)).

## 7. Randomness and ids

- Use `crypto.getRandomValues` for random numbers and ids, never `Math.random` for outcomes
  and never `crypto.randomUUID` in client code (unavailable outside secure contexts).
- RGS and math functions that draw random numbers take a `Random` parameter so tests can inject
  a deterministic one.
