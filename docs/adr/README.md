# Architecture Decision Records

An ADR captures one architecturally significant decision: the context, the decision itself,
the options that were considered and the consequences.

## Conventions

- Format: [MADR](https://adr.github.io/madr/), see [000-template.md](000-template.md).
- File name: `NNN-kebab-case-title.md`, numbered sequentially.
- Status: `Proposed` → `Accepted`.
- Until the first release an ADR is edited in place: the current decision and the options that
  were considered are all in one record, and git keeps the history. After the first release a
  changed decision gets a new ADR; the old one becomes `Superseded by NNN` and the new one says
  `Supersedes NNN`.

## Index

| #                                                   | Decision                                               | Status   |
| --------------------------------------------------- | ------------------------------------------------------ | -------- |
| [001](001-record-architecture-decisions.md)         | Record architecture decisions                          | Accepted |
| [002](002-monorepo-pnpm-workspaces.md)              | Monorepo with pnpm workspaces: `apps/` and `packages/` | Accepted |
| [003](003-typescript-pixijs.md)                     | TypeScript + PixiJS                                    | Accepted |
| [004](004-server-owns-spin-outcome.md)              | The server owns the spin outcome                       | Accepted |
| [005](005-websocket-protocol-schema-first-zod.md)   | WebSocket protocol, schema-first with zod              | Accepted |
| [006](006-client-layering-logic-view-controller.md) | Client layering: logic / view / controller             | Accepted |
| [007](007-money-integer-cents-server-coins.md)      | Money in integer cents and server-side coins           | Accepted |
| [008](008-session-model-and-reconnect.md)           | Session model and reconnect                            | Accepted |
| [009](009-round-ids-and-lost-response-recovery.md)  | Round ids and lost-response recovery                   | Accepted |
| [010](010-heartbeat-and-request-timeout.md)         | Heartbeat and request timeout                          | Accepted |
| [011](011-debug-commands-and-preset-outcomes.md)    | Debug commands and preset outcomes                     | Accepted |
| [012](012-transport-agnostic-rgs-and-demo-mode.md)  | Transport-agnostic RGS and demo mode                   | Accepted |
| [013](013-static-deploy-github-pages.md)            | Static deploy to GitHub Pages                          | Accepted |
| [014](014-platform-rgs-and-self-contained-game.md)  | Platform, RGS and a self-contained game                | Accepted |
