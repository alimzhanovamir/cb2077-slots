# Code style

How code in this repository looks. Rules marked **(lint)** are enforced by ESLint or Prettier
(`eslint.config.js`, `.prettierrc.json`) and most are fixed by `pnpm lint --fix` and
`pnpm format`; the rest are conventions checked in review.

The base is Prettier + `typescript-eslint` (`strictTypeChecked` and `stylisticTypeChecked`),
plus a selection of Airbnb rules and the readability rules below.

## Formatting

- Prettier formats everything: 2 spaces, semicolons, trailing commas, **100** characters per
  line **(lint)**.
- Strings use double quotes **(lint)**: `@stylistic/quotes` with `avoidEscape`, so a string
  that itself contains double quotes may use single quotes. Template literals are for
  interpolation.
- Every `if`, `else`, `for` and `while` body has braces, even a one-liner **(lint)**: `curly: all`.

  ```ts
  // Bad
  if (isCurrent()) this.receive(raw);

  // Good
  if (isCurrent()) {
    this.receive(raw);
  }
  ```

## Blank lines

A blank line goes **(lint)**:

- before and after a block statement (`if`, `for`, `while`, `switch`, `try`, …);
- before and after a function, a class, an `interface` and a multi-line statement, declaration,
  type or export;
- before and after a group of `const`/`let` declarations;
- before `return` (unless it is the first statement of its block);
- between class members, except between single-line fields.

Consecutive single-line declarations, imports, type aliases and exports may stay together.

```ts
// Bad
const generation = this.generation;
this.setStatus("connecting");
if (wasOnline) {
  this.emit("disconnected", undefined);
}
return delay;

// Good
const generation = this.generation;
const isCurrent = () => generation === this.generation;

this.setStatus("connecting");

if (wasOnline) {
  this.emit("disconnected", undefined);
}

return delay;
```

## Expressions

- No nested ternaries **(lint)**. Keep a ternary short; when it gets long or sits inside a call's
  arguments, move it to a named variable.
- `++`/`--` only as a standalone statement or in a `for` update **(lint)**; inside an expression
  write `x += 1` on its own line first.
- No clever short-circuits **(lint)**: no `...(condition && { key })` and no `a && doSomething()`
  as a statement. Write an explicit `if`, or pass `undefined` (JSON serialisation drops it).
- Early return instead of nested `if`; no `else` after `return` **(lint)**: `no-else-return`.
- `===` only **(lint)**, template literals instead of string concatenation **(lint)**, object
  shorthand **(lint)**.
- `for...of` is fine (and needed for `await`, `break`, `continue`); `forEach` for short
  callbacks.
- Named constants instead of magic numbers (`DEFAULT_REQUEST_TIMEOUT_MS`, not `5000`).
  Layout coordinates in placeholder view code may stay inline. Animation timings live in
  `packages/game/src/theme.ts`; the platform's minimum spin time is `MIN_SPIN_MS` in
  `apps/client/src/app/GameController.ts`.

## Functions

- Top-level named functions are `function` declarations **(lint)**; arrow functions are for
  callbacks and small local helpers.
- Exported functions and public methods declare their return type **(lint)**:
  `explicit-module-boundary-types`.
- Promises are awaited or handled **(lint)**: `no-floating-promises` without the `void` escape
  hatch. A call nobody waits for ends with `.catch(handler)`, so an error cannot pass silently;
  in the client, `logUnexpectedError` (`apps/client/src/util/errors.ts`) is the default handler.

  ```ts
  // Bad: a rejection becomes an unhandled rejection
  void this.spin();

  // Good
  this.spin().catch(logUnexpectedError);
  ```

## Types

- `type` for object shapes, unions and `z.infer` results; `interface` only for a contract that
  something implements — a class (`SessionStore`) or a package matching it by shape (`Game`,
  `GameMath`, ADR 014) — and for global declaration merging (`Window`, `ImportMetaEnv`).
- An inline object type with more than two fields gets a name (`RoundSummary`, not
  `{ bet: Cents; totalWin: Cents; balance: Cents }`). Members of a named discriminated union may
  stay inline.
- No non-null assertions (`value!`) **(lint)**. Narrow with a check, use `?.`/`??`, or throw
  with a message when a broken invariant is a bug.
- Type assertions (`as`) only when there is no checked alternative, each with a comment saying
  why it is safe. Object literals are never asserted **(lint)**. Prefer the dedicated helpers
  (`asCents`) over a bare `as`.
- Branded ids, `Cents` and `as const` objects instead of enums: see
  [architecture rules](architecture/rules.md).

## Classes

Members are ordered **(lint)**: `@typescript-eslint/member-ordering`:

1. fields;
2. constructor;
3. getters and setters;
4. private methods;
5. protected methods;
6. public methods (static ones included).

TypeScript's `private` is used, not `#private`.

## Modules

- Named exports only **(lint)**; default exports only where a tool requires them (`*.config.ts`).
- `export * from` only in a package entry point (`packages/shared/src/index.ts`).
- Types are imported and re-exported with `type` **(lint)**: `import type { Cents } from …`
  when every name is a type, `import { GameServer, type GameServerOptions } from …` when the
  import mixes values and types; the same for `export type`. Enforced by
  `consistent-type-imports`, `no-import-type-side-effects`, `consistent-type-exports` and
  `verbatimModuleSyntax` in `tsconfig.base.json`.
- Imports are sorted **(lint)**: `eslint-plugin-simple-import-sort` with groups side effects →
  `node:` → packages → `@cb2077/*` → relative, separated by a blank line.

## Names

- Identifiers are full words: `connection`, `context`, `dependencies`, not `conn`, `ctx`,
  `deps`; no single-letter names. External API names (`process.env`, `deltaMS`) and unit
  suffixes (`latencyMs`) are fine.
- Casing: see [architecture rules § Naming](architecture/rules.md#4-naming).

## Comments

- JSDoc (`/** … */`) on exported functions, classes and types whose purpose is not obvious from
  the name.
- Inline comments explain _why_, not _what_.
