# 005. WebSocket protocol, schema-first with zod

- Status: Accepted
- Date: 2026-10-06

## Context

Client and server exchange requests (init, spin, debug commands) and server-initiated messages
(balance updates, session takeover). Both sides are TypeScript and must agree on the message
shapes. TypeScript types disappear at runtime, so data coming over the network must be
validated.

## Decision

- Transport: WebSocket, JSON text frames. Every request carries a client-generated
  `requestId`; the response echoes it.
- Messages are discriminated unions on the `type` field.
- **Schema-first**: zod v4 schemas in `packages/shared/src/schemas` are the single source of truth;
  TypeScript types are inferred with `z.infer`. No hand-written duplicate types.
- `shared` contains only what crosses the wire (the contract), in two entry points: the
  envelope (`@cb2077/shared`) for the platform and the RGS, and the game payload
  (`@cb2077/shared/game`) for the game and its math (ADR 014). Server-internal models
  (sessions, reel strips, the game state) live in `rgs` and `math`; client models live in
  `client`.
- Validation happens only at boundaries: incoming messages on both sides, configuration
  files and environment variables at startup. Inside the application plain types are trusted.
- Ids and money are branded types (`SessionId`, `RoundId`, `RequestId`, `Cents`) so that they
  cannot be mixed up.

## Considered options

- **WebSocket** — one persistent connection, server push for balance updates and session
  takeover. Chosen.
- **HTTP/REST** — no server push without polling or SSE.
- **zod** — the most widely known schema library, good TypeScript inference. Chosen.
- **ArkType** — faster and terser, but less widespread; speed is irrelevant at our message rate.
- **Hand-written types + manual checks** — types and checks drift apart.

## Consequences

- Changing a message means changing one schema; the compiler finds every affected place.
- Invalid input is rejected with `BAD_REQUEST` instead of crashing a handler.
- zod is a runtime dependency of the client bundle.
