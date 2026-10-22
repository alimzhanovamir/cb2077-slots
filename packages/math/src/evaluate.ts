import { asCents, type Cents } from "@cb2077/shared";
import type { Grid, Position, SymbolId, Win } from "@cb2077/shared/game";

import type { MathConfig } from "./config.ts";

export type Evaluation = {
  wins: Win[];
  totalWin: Cents;
};

const MIN_REELS = 3;

/**
 * 243 ways: a symbol wins when it appears on adjacent reels starting from the leftmost one,
 * in any row. `ways` is the product of its counts on those reels;
 * `payout = paytable[symbol][reelCount] × ways × coinValue`.
 */
export function evaluate(
  grid: Grid,
  paytable: MathConfig["paytable"],
  coinValue: number,
): Evaluation {
  const wins: Win[] = [];

  // `Object.entries` widens keys to `string`; the paytable is keyed by `SymbolId`.
  for (const [symbol, payouts] of Object.entries(paytable) as [
    SymbolId,
    (typeof paytable)[SymbolId],
  ][]) {
    const positions: Position[] = [];
    let ways = 1;
    let reelCount = 0;

    for (const [reel, column] of grid.entries()) {
      const rows = column.flatMap((cell, row) => (cell === symbol ? [row] : []));

      if (rows.length === 0) {
        break;
      }

      ways *= rows.length;
      reelCount += 1;

      for (const row of rows) {
        positions.push({ reel, row });
      }
    }

    if (reelCount < MIN_REELS) {
      continue;
    }

    const count = reelCount as 3 | 4 | 5;
    const coins = payouts[count];

    if (coins === 0) {
      continue;
    }

    wins.push({
      symbol,
      reelCount: count,
      ways,
      payout: asCents(coins * ways * coinValue),
      positions,
    });
  }

  const totalWin = asCents(wins.reduce((sum, win) => sum + win.payout, 0));

  return { wins, totalWin };
}
