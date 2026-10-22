import { type Grid, ROWS, type SymbolId } from "@cb2077/shared/game";

import type { Random } from "./random.ts";

export type ReelStrips = readonly (readonly SymbolId[])[];

/** One random stop position per reel. */
function drawStops(strips: ReelStrips, random: Random): number[] {
  return strips.map((strip) => random.nextInt(strip.length));
}

/** The visible grid: `ROWS` consecutive symbols of each strip, starting at its stop (looped). */
export function gridFromStops(strips: ReelStrips, stops: readonly number[]): Grid {
  return strips.map((strip, reel) => {
    const stop = stops[reel] ?? 0;

    return Array.from({ length: ROWS }, (_, row) => symbolAt(strip, stop + row));
  });
}

/** The symbol at `index` of a looped strip. */
function symbolAt(strip: readonly SymbolId[], index: number): SymbolId {
  const symbol = strip[index % strip.length];

  if (symbol === undefined) {
    throw new Error("A reel strip must not be empty");
  }

  return symbol;
}

export function randomGrid(strips: ReelStrips, random: Random): Grid {
  return gridFromStops(strips, drawStops(strips, random));
}
