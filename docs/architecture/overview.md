# Architecture overview

## Layers

The repository mirrors how a production slot is split
([ADR 014](../adr/014-platform-rgs-and-self-contained-game.md)):

| Production layer    | Here                                | Owns                                                                                |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Platform (wrapper)  | `apps/client`                       | page, connection, round lifecycle, money and bets, money formatting, HTML system UI |
| Game (presentation) | `packages/game`                     | its own canvas, scene, reels, bottom panel, the whole round presentation            |
| RGS core            | `packages/rgs` + `apps/server` host | sessions, rounds, balance, bet limits, last-round recovery, debug commands          |
| Game math           | `packages/math`                     | reel strips, paytable, 243 ways, debug presets                                      |
| Protocol            | `packages/shared`                   | the envelope (`@cb2077/shared`) and the game payload (`@cb2077/shared/game`)        |

The generic layers (platform, RGS) define a contract and carry the game's data as an opaque
payload (`unknown`). The game's layers (presentation, math) import nothing from the platform or
the RGS and match the contracts by shape.

## System context

The platform talks to the RGS through a `Transport`. Two transports exist (ADR 012):

- **ws** — a Node.js server reached over WebSocket (development, E2E);
- **demo** — the same RGS and math running inside the page, no server (GitHub Pages).

```mermaid
flowchart LR
  player([Player])
  dev([Developer / E2E test])
  subgraph browser[Browser]
    platform[Platform<br/>HTML system layer]
    game[Game<br/>PixiJS canvas]
    drawer[Debug drawer<br/>DOM]
    demo[In-page emulator<br/>RGS + math + localStorage]
  end
  server[Node.js server<br/>RGS + math + in-memory sessions]

  player --> game
  game -- "player actions" --> platform
  platform -- "HUD, rounds (outcome unread)" --> game
  dev --> drawer
  drawer --> platform
  platform -- "ws transport<br/>WebSocket, JSON" --> server
  platform -. "demo transport<br/>in-page calls, JSON" .-> demo
```

## Packages

Deployable apps live in `apps/` (`client`, `server`), libraries in `packages/` (`shared`, `game`,
`rgs`, `math`) and the E2E suite in `e2e/` ([ADR 002](../adr/002-monorepo-pnpm-workspaces.md)).

```mermaid
flowchart TB
  shared[shared<br/>envelope schemas]
  payload[shared/game<br/>game payload schemas]
  game[game<br/>PixiJS presentation]
  rgs[rgs<br/>sessions, handlers, debug]
  math[math<br/>strips, paytable, 243 ways]
  server[server<br/>WebSocket + ping/pong]
  client[client<br/>platform]
  e2e[e2e<br/>Playwright]

  client --> shared
  client -- "main.ts only" --> game
  client -. "net/demo only,<br/>dynamic import" .-> rgs
  client -. "net/demo only" .-> math
  game --> payload
  rgs --> shared
  math --> payload
  math --> shared
  server --> rgs
  server --> math
  e2e -. "drives via browser" .-> client
```

`rgs` does not depend on `math`, and `client` does not depend on the game's code beyond
`main.ts`: the composition roots (`main.ts`, `apps/server/src/index.ts`, `net/demo`) wire the
game's packages into the generic ones.

### Platform layers (ADR 006)

```mermaid
flowchart LR
  subgraph client[apps/client]
    app[app/GameController]
    logic[logic<br/>state machine, bet]
    view[view<br/>Game contract, SystemLayer]
    net[net<br/>Transport, GameClient]
    debug[debug<br/>drawer]
  end
  gamePackage[["@cb2077/game"]]
  app --> logic
  app --> view
  app --> net
  debug --> net
  app -. "Game contract" .-> gamePackage
```

`logic` and `view` never import each other or `net`; only `app/GameController` wires them.

### Contract between the platform and the game

```ts
// apps/client/src/view/Game.ts (abridged)
interface Game {
  setActions: (actions: PlayerActions) => void; // spin, bet − / +, step
  show: (game: unknown) => void; // init.game
  update: (state: HudState) => void; // balance, bet, step, win, enabled controls
  startSpin: () => void;
  presentRound: (outcome: unknown, summary: { totalWin: Cents }) => Promise<void>;
  abortSpin: () => Promise<void>;
  pause: () => void; // a system window is open: animation and game time stop
  resume: () => void;
}
```

### RGS and math

```mermaid
flowchart LR
  connection[Connection<br/>send / close] --> gameServer[GameServer<br/>parse, validate, route, latency]
  gameServer --> handlers[handlers<br/>init · spin · debug.*]
  handlers --> sessionManager[SessionManager<br/>takeover, TTL]
  sessionManager --> store[(SessionStore<br/>Map or localStorage)]
  handlers -- "GameMath: play, gameInit, presets" --> math[math<br/>spin → grid → evaluate]
```

The RGS stores the math's `gameState` and forwards its `outcome` without reading either.

## Key flows

### Start and init

```mermaid
sequenceDiagram
  participant G as Game
  participant P as Platform
  participant S as RGS + math
  P->>P: read sessionId from localStorage
  P->>S: init { requestId, sessionId? }
  alt known session
    S-->>P: init { resumed: true, balance, bet, config, lastRound, debug, game }
  else unknown or missing
    S->>S: create session: starting balance, math.newState()
    S-->>P: init { resumed: false, sessionId, balance, bet, config, debug, game }
  end
  P->>P: store sessionId, phase = idle, hide the system window
  P->>G: show(init.game) — passed on unread
  G->>G: parse GameInit, show the grid
```

### Spin

```mermaid
sequenceDiagram
  participant G as Game
  participant P as Platform
  participant S as RGS + math
  G->>P: spinPressed()
  P->>P: balance shown −= bet, phase = spinning
  P->>G: startSpin() — reels start at once
  P->>S: spin { requestId, bet }
  S->>S: validate bet, math.play() → outcome, totalWin; update balance
  S-->>P: spin { round: envelope + outcome }
  P->>P: wait the minimum spin time, phase = presenting
  P->>G: presentRound(round.outcome, { totalWin })
  G->>G: parse SpinOutcome, stop reels, highlight wins, show the total
  G-->>P: resolved
  P->>P: balance = round.balance, phase = idle
```

### Connection lost during a spin

```mermaid
sequenceDiagram
  participant G as Game
  participant P as Platform
  participant S as RGS
  P->>S: spin { requestId: R }
  S->>S: round committed
  Note over P,S: response lost (drop or > 5s timeout)
  P->>P: close old connection, connection = reconnecting
  P->>G: pause() — HTML window "Reconnecting…" over the game
  P->>S: (new connection) init { sessionId }
  S-->>P: init { lastRound }
  P->>G: resume()
  alt lastRound.requestId == R
    P->>G: presentRound(lastRound.outcome)
  else
    P->>G: abortSpin() — spin never arrived, stop on the previous grid
  end
```

### Second tab takes over the session

```mermaid
sequenceDiagram
  participant A as Tab A
  participant S as RGS
  participant B as Tab B
  B->>S: init { sessionId }
  S-->>A: sessionReplaced
  S->>A: close connection
  S-->>B: init { ... }
  A->>A: connection = replaced, game paused, HTML window with "Play here"
```

## Platform state

The platform tracks two independent things in `logic/GameModel`, because a connection can drop
in any spin phase. It works with the round's envelope only; how a round looks is the game's
business.

**Spin phase** (`logic/SpinStateMachine`):

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> spinning: spin started (bet shown as deducted)
  spinning --> presenting: round received (game presents it) or spin failed (game stops)
  presenting --> idle: game done (balance and win from the round)
```

**Connection** (driven by `net/GameClient`):

```mermaid
stateDiagram-v2
  [*] --> connecting
  connecting --> online: init received
  online --> reconnecting: connection lost / request timeout
  reconnecting --> online: init received (pending spin resolved)
  online --> replaced: sessionReplaced
  replaced --> connecting: "Play here"
```

While `reconnecting`, a spin in flight keeps spinning (the game is paused under the system
window); after `init` it is either presented (`lastRound.requestId` matches) or stopped on the
previous grid as not played (ADR 009). Spin and bet controls are enabled only when the
connection is `online` and the phase is `idle`. If the game cannot present a round, the platform
shows a notice; the round's money counts as the server reported it. If the game cannot read
`init.game`, or the RGS answers `init` with an error, the game cannot start: the platform shows a
blocking window asking to reload, and spins stay disabled until an `init` succeeds.
