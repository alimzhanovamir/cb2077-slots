import { z } from "zod";

import { Cents, PresetId, RequestId, RoundId } from "./primitives.ts";

export const Currency = z.object({
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(4),
});

export type Currency = z.infer<typeof Currency>;

/** Bets and currency of the session: what the platform needs to take bets and show money. */
export const PlatformConfig = z.object({
  minBet: Cents,
  maxBet: Cents,
  defaultBet: Cents,
  /** Every bet must be a multiple of this amount. */
  betGranularity: Cents,
  /** Amounts the − / + buttons can step by. */
  stepSizes: z.array(Cents).min(1),
  defaultStep: Cents,
  currency: Currency,
});

export type PlatformConfig = z.infer<typeof PlatformConfig>;

/**
 * A played round as the RGS and the platform see it: the envelope. The game's own data is
 * `outcome`, opaque here; only the game and its math read it (`@cb2077/shared/game`, ADR 014).
 */
export const Round = z.object({
  roundId: RoundId,
  seq: z.number().int().positive(),
  requestId: RequestId,
  bet: Cents,
  totalWin: Cents,
  /** Balance after this round. */
  balance: Cents,
  /** Set when the outcome came from a debug preset. */
  forced: PresetId.optional(),
  /** Game payload (`SpinOutcome`). Passed through unread. */
  outcome: z.unknown(),
});

export type Round = z.infer<typeof Round>;
