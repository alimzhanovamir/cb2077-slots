import { z } from "zod";

import { REELS, ROWS, SymbolId } from "@cb2077/shared/game";

import rawConfig from "./config.json";

const Payouts = z.object({
  3: z.number().int().nonnegative(),
  4: z.number().int().nonnegative(),
  5: z.number().int().nonnegative(),
});

export const MathConfig = z.object({
  /** A bet is split into this many coins; bets must be a multiple of it (in cents). */
  coinsPerBet: z.number().int().positive(),
  /** Payout in coins per symbol and number of reels. */
  paytable: z.record(SymbolId, Payouts),
  /** One looped strip of symbols per reel. */
  reelStrips: z.array(z.array(SymbolId).min(ROWS)).length(REELS),
});

export type MathConfig = z.infer<typeof MathConfig>;

/** The game math, validated once at startup (fail fast on a broken config file). */
export const mathConfig: MathConfig = MathConfig.parse(rawConfig);
