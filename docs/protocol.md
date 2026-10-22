# Protocol

Client and server exchange JSON messages over a `Transport` (WebSocket in `ws` mode, in-page
calls in `demo` mode — the messages are identical). The schemas in
[`packages/shared/src`](../packages/shared/src) are authoritative; this page explains them.

The protocol has two parts (ADR 014):

- **the envelope** (`@cb2077/shared`, `src/schemas`): sessions, bets, balance, rounds, errors,
  debug — read by the platform (`apps/client`) and the RGS (`packages/rgs`);
- **the game payload** (`@cb2077/shared/game`, `src/game`): what the reels show and what it
  pays — produced by the math (`packages/math`) and read by the game (`packages/game`). In the
  envelope it travels as `unknown` (`Round.outcome`, `init.game`); the platform and the RGS
  pass it on without reading or validating it.

## Conventions

- Every message has a `type`. Debug messages are prefixed with `debug.`.
- Every client message carries a client-generated `requestId`; the response echoes it.
- Server push messages (`balance`, `sessionReplaced`, a pushed `debug.state`) have no
  `requestId`.
- Money is integer cents (`Cents`). `€$ 12.50` is `1250`.
- `grid[reel][row]` (game payload): 5 reels (columns) × 3 rows; `grid[0]` is the leftmost reel,
  `row 0` is the top row.
- Messages within one connection are delivered in order, so a `debug.forceNext` sent before
  a `spin` always applies to that spin.

## Types

Envelope (`@cb2077/shared`):

```ts
type Cents = number; // branded, safe non-negative integer
type ErrorCode = "INSUFFICIENT_FUNDS" | "INVALID_BET" | "BAD_REQUEST" | "INTERNAL";

type Round = {
  roundId: string;
  seq: number;
  requestId: string;
  bet: Cents;
  totalWin: Cents;
  balance: Cents; // after this round
  forced?: string; // debug preset id
  outcome: unknown; // game payload: SpinOutcome
};
type PlatformConfig = {
  minBet: Cents;
  maxBet: Cents;
  defaultBet: Cents;
  betGranularity: Cents;
  stepSizes: Cents[];
  defaultStep: Cents;
  currency: { symbol: string; decimals: number };
};
type DebugState = { forceNext?: string; failNext?: ErrorCode; latencyMs: number };
type DebugInfo = { presets: { id: string; label: string }[]; state: DebugState };
```

Game payload (`@cb2077/shared/game`):

```ts
type SymbolId = "chip" | "eddie" | "implant" | "deck" | "pistol" | "katana" | "solo" | "netrunner";
type Grid = SymbolId[][]; // grid[reel][row]
type Position = { reel: number; row: number };
type Win = {
  symbol: SymbolId;
  reelCount: 3 | 4 | 5;
  ways: number;
  payout: Cents;
  positions: Position[];
};
type SpinOutcome = { grid: Grid; wins: Win[] }; // Round.outcome
type GameInit = { reels: 5; rows: 3; symbols: SymbolId[]; grid: Grid }; // init.game
```

## Messages

### `init`

Starts or resumes a session. Sent after every (re)connect.

```json
→ { "type": "init", "requestId": "a1b2c3", "sessionId": "s-9f8e7d" }

← { "type": "init", "requestId": "a1b2c3",
    "sessionId": "s-9f8e7d", "resumed": true,
    "balance": 100140, "bet": 100,
    "lastRound": { "...": "see spin" },
    "config": { "minBet": 50, "maxBet": 50000, "defaultBet": 100, "betGranularity": 50,
                "stepSizes": [50,100,200,500,1000,2000,5000], "defaultStep": 100,
                "currency": { "symbol": "€$", "decimals": 2 } },
    "debug": { "presets": [{ "id": "noWin", "label": "No win" }, { "id": "maxWin", "label": "Max win" }],
               "state": { "latencyMs": 0 } },
    "game": { "reels": 5, "rows": 3,
              "symbols": ["chip","eddie","implant","deck","pistol","katana","solo","netrunner"],
              "grid": [["katana","chip","eddie"],["chip","katana","katana"],["katana","eddie","solo"],
                       ["eddie","implant","chip"],["solo","chip","eddie"]] } }
```

- `sessionId` is optional in the request. Missing or unknown → a new session
  (`resumed: false`) with the starting balance.
- `game` is the math's `GameInit`: `game.grid` is the last round's grid, or a random grid
  (nothing charged) for a new session.
- `bet` is the last round's bet, or `defaultBet`.
- If another connection holds the session, it receives `sessionReplaced` and is closed.
- An `error` in answer to `init` (e.g. `INTERNAL` when the math rejects the stored game state)
  means the session cannot start: the platform does not retry and asks the player to reload.

### `spin`

```json
→ { "type": "spin", "requestId": "k3f9", "bet": 100 }

← { "type": "spin", "requestId": "k3f9",
    "round": { "roundId": "r-7c1e", "seq": 12, "requestId": "k3f9", "bet": 100,
               "totalWin": 240, "balance": 100140,
               "outcome": {
                 "grid": [["katana","chip","eddie"],["chip","katana","katana"],["katana","eddie","solo"],
                          ["eddie","implant","chip"],["solo","chip","eddie"]],
                 "wins": [{ "symbol": "katana", "reelCount": 3, "ways": 2, "payout": 240,
                            "positions": [{"reel":0,"row":0},{"reel":1,"row":1},{"reel":1,"row":2},{"reel":2,"row":0}] }] } } }
```

The platform reads `bet`, `totalWin`, `balance` and `requestId`; it hands `outcome` to the game
unread, and the game validates it as a `SpinOutcome`.

Errors: `INVALID_BET` (outside `[minBet, maxBet]` or not a multiple of `betGranularity`),
`INSUFFICIENT_FUNDS` (`bet > balance`). Nothing is charged on error.

### Debug commands

Every debug command is answered with `debug.state` carrying the full current debug state.
`forceNext` and `failNext` apply to one spin: after the spin that used one up, the server pushes
`debug.state` without a `requestId` (right after the spin's answer, with the same latency), so
the debug drawer never shows an override that is already gone.

| Request                                                          | Effect                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `{ "type": "debug.forceNext", "requestId", "preset": "bigWin" }` | Next spin uses the preset grid; `null` clears                  |
| `{ "type": "debug.failNext", "requestId", "code": "INTERNAL" }`  | Next spin fails with this code, nothing charged; `null` clears |
| `{ "type": "debug.setLatency", "requestId", "ms": 3000 }`        | Delay every spin response (0 … 30 000 ms) until changed        |
| `{ "type": "debug.setBalance", "requestId", "balance": 500 }`    | Set the balance; also pushes `balance`                         |
| `{ "type": "debug.resetBalance", "requestId" }`                  | Balance back to the starting balance; also pushes `balance`    |
| `{ "type": "debug.dropConnection", "requestId" }`                | Server closes the connection without answering                 |

```json
← { "type": "debug.state", "requestId": "d1", "state": { "forceNext": "bigWin", "latencyMs": 0 } }
```

Resetting the session is client-side: forget the stored `sessionId`, reconnect, send `init`
without it.

### Server push

```json
← { "type": "balance", "balance": 100000 }
← { "type": "sessionReplaced" }
← { "type": "debug.state", "state": { "latencyMs": 0 } }
```

### `error`

```json
← { "type": "error", "requestId": "k3f9", "code": "INSUFFICIENT_FUNDS", "message": "Bet exceeds balance" }
```

| Code                 | When                                           | Client reaction                              |
| -------------------- | ---------------------------------------------- | -------------------------------------------- |
| `INSUFFICIENT_FUNDS` | `bet > balance`                                | Reels stop on previous grid, message, `idle` |
| `INVALID_BET`        | Bet out of range or wrong granularity          | Same as above                                |
| `BAD_REQUEST`        | Invalid JSON, unknown `type`, schema mismatch  | Same as above (indicates a client bug)       |
| `INTERNAL`           | Unexpected server exception; session unchanged | Same as above                                |

`requestId` is omitted when the request could not be parsed.

## Timing and connection health

| Mechanism                                                     | Value                         | Mode     |
| ------------------------------------------------------------- | ----------------------------- | -------- |
| Server ping interval; no pong since previous ping → terminate | 15s                           | ws       |
| Client request timeout → close and reconnect                  | 5s                            | ws, demo |
| Reconnect backoff                                             | 0.5s, 1s, 2s, 4s, 8s, max 10s | ws, demo |
| Minimum reel spin time                                        | 1s                            | ws, demo |
| Session expiry after last disconnect                          | 30 min                        | ws, demo |
