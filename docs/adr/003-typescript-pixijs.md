# 003. TypeScript + PixiJS

- Status: Accepted
- Date: 2026-10-06

## Context

The game is an HTML5 slot: animated reels, win presentations and effects at 60 fps on desktop
and mobile. The whole game, including its controls, is rendered on a canvas. We need a
rendering library and a decision on whether a UI framework is involved.

## Decision

- Language: TypeScript (strict mode) everywhere, pinned to 6.0 (`~6.0.3`).
- Rendering: PixiJS v8 (WebGL with fallbacks), the de-facto standard for HTML5 slots.
- Build: Vite.
- No DOM UI framework. The game draws everything on its canvas; the only DOM UI is the
  platform's (its system windows, ADR 014, and the developer debug drawer), written in plain
  TypeScript.

## Considered options

- **PixiJS** — fast 2D renderer, large ecosystem (filters, spine, particles), used widely in
  the slot industry. Chosen.
- **Phaser** — a full game framework (physics, scenes, input); most of it is unused in a slot.
- **Plain Canvas 2D / WebGL** — too much low-level work for no benefit.

TypeScript version and linter:

- **TypeScript 6.0 + ESLint with `typescript-eslint`** — chosen. Our lint rules depend on type
  information (`strictTypeChecked`, `stylisticTypeChecked`, `no-floating-promises`), and only
  `typescript-eslint` covers all of them together with the ESLint plugins we use
  (`@stylistic`, `simple-import-sort`). It supports TypeScript `>=4.8.4 <6.1.0`.
- **TypeScript 7** — the native (Go) compiler, much faster. Rejected for now: its npm package
  no longer exposes the classic compiler API (`require("typescript")` returns only the version;
  the API lives under `typescript/unstable/*`), so `typescript-eslint` cannot run on it.
- **Oxlint + `oxlint-tsgolint`** — a Rust linter with type-aware rules built on TypeScript 7.
  Not chosen yet: fewer type-aware rules than `typescript-eslint`, and not all of our ESLint
  plugins have an equivalent.
- **Biome** — linter and formatter in one tool; infers types itself without the compiler, so
  its type-aware rules are fewer and approximate.

## Consequences

- One rendering model for the game: everything the game draws is a Pixi display object. Only
  the game package uses Pixi; the platform's system windows are HTML (ADR 014).
- Canvas UI is invisible to the DOM: E2E tests need a test hook (see
  [testing](../testing.md#e2e-driving-a-canvas-game)), and accessibility
  is limited (see [limitations](../limitations.md)).
- Separation of logic and rendering is achieved by architecture (ADR 006), not by a framework.
- TypeScript stays on 6.0: TypeScript 7 is blocked by `typescript-eslint`, not by ESLint itself.
  The decision is revisited when one of these happens:
  - `typescript-eslint` supports TypeScript 7 — upgrade TypeScript and keep ESLint; Oxlint stays
    optional, only for speed;
  - Oxlint covers all of our rules — move to TypeScript 7 with Oxlint alone. While coverage is
    partial, `eslint-plugin-oxlint` turns off the ESLint rules Oxlint already implements so both
    linters run side by side, but that alone does not unblock TypeScript 7.
- Untested workaround: `@typescript/typescript6` publishes TypeScript 6 under another name, so
  `typescript-eslint` could be pointed at it with `pnpm.overrides` while `tsc` runs TypeScript 7.
  The linter would then check types with 6.0 semantics and the compiler with 7.0 semantics.
