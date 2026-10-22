import {
  asCents,
  type Cents,
  type PlatformConfig,
  type RequestId,
  type Round,
  type RoundId,
} from "@cb2077/shared";

import type { InitData } from "../src/logic/GameModel.ts";

export function cents(value: number): Cents {
  return asCents(value);
}

export const CONFIG: PlatformConfig = {
  minBet: cents(50),
  maxBet: cents(50_000),
  defaultBet: cents(100),
  betGranularity: cents(50),
  stepSizes: [50, 100, 200, 500, 1000, 2000, 5000].map(cents),
  defaultStep: cents(100),
  currency: { symbol: "€$", decimals: 2 },
};

/** The platform never reads a round's outcome, so any value will do (ADR 014). */
export const OUTCOME = { opaque: "the game's data" };

export function initData(overrides: Partial<InitData> = {}): InitData {
  return {
    resumed: false,
    balance: cents(100_000),
    bet: cents(100),
    config: CONFIG,
    ...overrides,
  };
}

export function round(requestId: string, overrides: Partial<Round> = {}): Round {
  // Test ids: the format is not checked on the client.
  return {
    roundId: "r-1" as RoundId,
    seq: 1,
    requestId: requestId as RequestId,
    bet: cents(100),
    totalWin: cents(0),
    balance: cents(99_900),
    outcome: OUTCOME,
    ...overrides,
  };
}
