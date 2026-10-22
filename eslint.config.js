import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

/** `no-restricted-imports` pattern for a folder in relative imports (e.g. `../view/Game.ts`). */
function folder(name, message) {
  return { regex: `(^|/)${name}(/|$)`, message };
}

/**
 * A relative path into another package (`../../rgs/src/GameMath.ts`) would bypass every package
 * ban below, so packages import each other only by name (ADR 002).
 */
const crossPackage = {
  regex: "\\.\\./(.+/)?src/",
  message: "Import another package by name (`@cb2077/…`), never by a relative path (ADR 002).",
};

/** A boundary rule. It always adds the cross-package ban: a rule of the same name replaces. */
function layerRule(patterns, paths = []) {
  return ["error", { patterns: [...patterns, crossPackage], paths }];
}

/** The game's payload is opaque to the platform and the RGS (ADR 014). */
function payloadBan(who) {
  return {
    regex: "^@cb2077/shared/game",
    message: `${who} must not read the game's payload: it passes it on as \`unknown\` (ADR 014).`,
  };
}

/** Imports from other packages that a client layer (everything except main.ts and net/demo) must not use. */
function clientPackageBans(layer) {
  return [
    {
      regex: "^@cb2077/(rgs|math)",
      message: "Only net/demo may import the RGS and the math (ADR 012).",
    },
    {
      regex: "^@cb2077/game",
      message: `${layer} must not import the game: only main.ts starts it (ADR 014).`,
    },
    payloadBan("The platform"),
  ];
}

/** The platform has no renderer of its own: its UI is HTML (ADR 014). */
const noPixi = [
  { name: "pixi.js", message: "The platform does not render with Pixi; the game does (ADR 014)." },
];

function platformNeutral(who) {
  return ["fs", "path", "crypto", "ws", "pixi.js"].map((name) => ({
    name,
    message: `${who} must stay platform-neutral (ADR 012).`,
  }));
}

/**
 * `no-restricted-syntax` entries shared by every file; config files additionally allow default
 * exports.
 */
const restrictedSyntax = [
  { selector: "TSEnumDeclaration", message: "Use `as const` objects instead of enums." },
  {
    selector: ":not(ExpressionStatement, ForStatement) > UpdateExpression",
    message: "Use `++`/`--` only as a standalone statement; write `x += 1` inside expressions.",
  },
  {
    selector: "SpreadElement > LogicalExpression[operator='&&']",
    message: "Avoid `...(condition && {...})`; build the object with an explicit `if`.",
  },
  {
    selector: [
      "Program > VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression).init",
      "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression).init",
    ].join(", "),
    message:
      "Declare top-level functions with `function`; arrows are for callbacks and local helpers.",
  },
];

const sharedIsSelfContained = {
  regex: "^@cb2077/",
  message: "shared must not depend on other packages.",
};

const noDefaultExport = { selector: "ExportDefaultDeclaration", message: "Use named exports." };

/** Blank lines around these statements (docs/code-style.md). */
const paddedStatements = [
  "block-like",
  "class",
  "function",
  "interface",
  "multiline-const",
  "multiline-let",
  "multiline-expression",
  "multiline-export",
  "multiline-type",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-*/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      // `interface` is for contracts implemented by classes, `type` for everything else:
      // checked in review.
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `||` on strings is intended: an empty environment variable means "not set".
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
      "@typescript-eslint/member-ordering": [
        "error",
        {
          default: "never",
          classes: [
            "signature",
            "field",
            "static-initialization",
            "constructor",
            ["get", "set"],
            "private-method",
            "protected-method",
            "public-method",
          ],
        },
      ],
      "no-restricted-syntax": ["error", ...restrictedSyntax, noDefaultExport],
      "no-nested-ternary": "error",
      "no-else-return": ["error", { allowElseIf: false }],
      eqeqeq: ["error", "always"],
      "prefer-template": "error",
      "object-shorthand": "error",
      "simple-import-sort/imports": [
        "error",
        { groups: [["^\\u0000"], ["^node:"], ["^(?!@cb2077/)@?\\w"], ["^@cb2077/"], ["^\\."]] },
      ],
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["**/*.config.{js,ts}"],
    rules: { "no-restricted-syntax": ["error", ...restrictedSyntax] },
  },

  // ---------------------------------------------------------------- Package boundaries (docs/architecture/rules.md)
  {
    files: ["packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule([sharedIsSelfContained]),
    },
  },
  {
    // The envelope carries the game's payload as `unknown`; importing it would make it readable.
    files: ["packages/shared/src/schemas/**/*.ts", "packages/shared/src/*.ts"],
    rules: {
      "no-restricted-imports": layerRule([
        sharedIsSelfContained,
        folder("game", "The envelope must not depend on the game's payload (ADR 014)."),
      ]),
    },
  },
  {
    files: ["packages/rgs/src/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          { regex: "^node:", message: "The RGS runs in browsers too: no Node.js APIs (ADR 012)." },
          {
            regex: "^@cb2077/(server|client|game|math)",
            message: "The RGS knows no game: the math is passed in as a GameMath (ADR 014).",
          },
          payloadBan("The RGS"),
        ],
        platformNeutral("The RGS"),
      ),
    },
  },
  {
    files: ["packages/math/src/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          { regex: "^node:", message: "The math runs in browsers too: no Node.js APIs (ADR 012)." },
          {
            regex: "^@cb2077/(server|client|game|rgs)",
            message: "The math imports no other layer: it matches GameMath by shape (ADR 014).",
          },
        ],
        platformNeutral("The math"),
      ),
    },
  },
  {
    files: ["packages/game/src/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule([
        {
          regex: "^@cb2077/(server|client|rgs|math)",
          message:
            "The game does not know where it runs: it matches the contract by shape (ADR 014).",
        },
        {
          regex: "^@cb2077/shared$",
          message:
            "The game reads only its own payload: import from @cb2077/shared/game (ADR 014).",
        },
      ]),
    },
  },
  {
    files: ["apps/server/src/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule([
        {
          regex: "^@cb2077/(client|game)",
          message:
            "The server hosts the RGS and the math; the platform and the game are the client's.",
        },
        payloadBan("The server"),
      ]),
    },
  },
  {
    files: ["apps/client/src/logic/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          folder("view", "logic must not import view (ADR 006)."),
          folder("net", "logic must not import net (ADR 006)."),
          folder("app", "logic must not import app (ADR 006)."),
          folder("debug", "logic must not import debug (ADR 006)."),
          ...clientPackageBans("logic"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/view/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          folder("logic", "view must not import logic (ADR 006)."),
          folder("net", "view must not import net (ADR 006)."),
          folder("app", "view must not import app (ADR 006)."),
          folder("debug", "view must not import debug (ADR 006)."),
          ...clientPackageBans("view"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/net/**/*.ts"],
    ignores: ["apps/client/src/net/demo/**"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          folder("logic", "net must not import logic (ADR 006)."),
          folder("view", "net must not import view (ADR 006)."),
          folder("app", "net must not import app (ADR 006)."),
          ...clientPackageBans("net"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/net/demo/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          folder("logic", "net must not import logic (ADR 006)."),
          folder("view", "net must not import view (ADR 006)."),
          folder("app", "net must not import app (ADR 006)."),
          { regex: "^@cb2077/game", message: "Only main.ts starts the game (ADR 014)." },
          payloadBan("The platform"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/debug/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          folder("logic", "debug must not import logic (ADR 006)."),
          folder("view", "debug must not import view (ADR 006)."),
          ...clientPackageBans("debug"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/app/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(clientPackageBans("app"), noPixi),
    },
  },
  {
    files: ["apps/client/src/util/**/*.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          ...["logic", "view", "net", "app", "debug"].map((layer) =>
            folder(layer, `util must not import ${layer}: every layer imports util (ADR 006).`),
          ),
          ...clientPackageBans("util"),
        ],
        noPixi,
      ),
    },
  },
  {
    files: ["apps/client/src/main.ts"],
    rules: {
      "no-restricted-imports": layerRule(
        [
          {
            regex: "^@cb2077/(rgs|math)",
            message: "Only net/demo may import the RGS and the math (ADR 012).",
          },
          payloadBan("The platform"),
        ],
        noPixi,
      ),
    },
  },
  {
    // Where rounds pass through, no casts at all: `round.outcome as SpinOutcome` would bypass
    // the opaque payload (ADR 014). `as const` stays allowed. Excluded: `util` (the typed
    // emitter) and the in-page emulator's storage, which carry no game data of their own.
    files: ["apps/client/src/**/*.ts", "packages/rgs/src/**/*.ts"],
    ignores: ["apps/client/src/util/**", "apps/client/src/net/demo/**"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    },
  },
  {
    // Contracts: function properties, so implementations must accept `unknown` (ADR 014).
    files: ["apps/client/src/view/Game.ts", "packages/rgs/src/GameMath.ts"],
    rules: {
      "@typescript-eslint/method-signature-style": ["error", "property"],
    },
  },

  // ---------------------------------------------------------------- Environments
  {
    files: ["apps/client/**/*.ts", "packages/game/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["apps/server/**/*.ts", "**/*.config.{js,ts}", "e2e/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  prettier,

  // ---------------------------------------------------------------- Code style (docs/code-style.md)
  // After `prettier`, which turns stylistic rules off. Prettier formats with double quotes too.
  {
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      curly: ["error", "all"],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: paddedStatements },
        { blankLine: "always", prev: paddedStatements, next: "*" },
        { blankLine: "always", prev: "*", next: ["const", "let"] },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        {
          blankLine: "any",
          prev: ["singleline-const", "singleline-let"],
          next: ["singleline-const", "singleline-let"],
        },
        { blankLine: "any", prev: "import", next: "import" },
        {
          blankLine: "any",
          prev: ["singleline-export", "singleline-type"],
          next: ["singleline-export", "singleline-type"],
        },
      ],
      "@stylistic/lines-between-class-members": [
        "error",
        "always",
        { exceptAfterSingleLine: true },
      ],
    },
  },
);
