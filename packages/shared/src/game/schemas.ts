import { z } from "zod";

import { Cents } from "../schemas/primitives.ts";

/**
 * The game's payload: what the math produces and the game presents. The RGS and the platform
 * carry it as `unknown` and must not import this module (ADR 014).
 */

export const REELS = 5;
export const ROWS = 3;

export const SYMBOL_IDS = [
  "chip",
  "eddie",
  "implant",
  "deck",
  "pistol",
  "katana",
  "solo",
  "netrunner",
] as const;

export const SymbolId = z.enum(SYMBOL_IDS);
export type SymbolId = z.infer<typeof SymbolId>;

/** `grid[reel][row]`: 5 reels (columns, left to right) × 3 rows (top to bottom). */
export const Grid = z.array(z.array(SymbolId).length(ROWS)).length(REELS);
export type Grid = z.infer<typeof Grid>;

export const Position = z.object({
  reel: z
    .number()
    .int()
    .min(0)
    .max(REELS - 1),
  row: z
    .number()
    .int()
    .min(0)
    .max(ROWS - 1),
});

export type Position = z.infer<typeof Position>;

export const Win = z.object({
  symbol: SymbolId,
  /** Number of adjacent reels from the left that contain the symbol. */
  reelCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  /** Product of the symbol counts on those reels. */
  ways: z.number().int().positive(),
  payout: Cents,
  /** Grid cells to highlight. */
  positions: z.array(Position),
});

export type Win = z.infer<typeof Win>;

/** `Round.outcome`: the grid the reels stop on and what it pays. */
export const SpinOutcome = z.object({
  grid: Grid,
  wins: z.array(Win),
});

export type SpinOutcome = z.infer<typeof SpinOutcome>;

/** `init.game`: the layout, the symbols and the grid to show when the game opens. */
export const GameInit = z.object({
  reels: z.literal(REELS),
  rows: z.literal(ROWS),
  symbols: z.array(SymbolId).min(1),
  grid: Grid,
});

export type GameInit = z.infer<typeof GameInit>;
