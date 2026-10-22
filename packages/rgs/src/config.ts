import type { z } from "zod";

import { PlatformConfig } from "@cb2077/shared";

import rawConfig from "./config.json";

/** Bet limits and currency: the RGS's part of the configuration, sent to the platform in `init`. */
export const BetConfig = PlatformConfig.superRefine((config, context) => {
  const issue = (message: string) => {
    context.addIssue({ code: "custom", message });
  };

  const { betGranularity: granularity } = config;

  if (granularity === 0) {
    issue("betGranularity must be positive");
  }

  for (const [name, amount] of [
    ["minBet", config.minBet],
    ["maxBet", config.maxBet],
    ["defaultBet", config.defaultBet],
  ] as const) {
    if (amount % granularity !== 0) {
      issue(`${name} must be a multiple of betGranularity`);
    }
  }

  if (config.minBet === 0 || config.minBet > config.maxBet) {
    issue("minBet must be in (0, maxBet]");
  }

  if (config.defaultBet < config.minBet || config.defaultBet > config.maxBet) {
    issue("defaultBet must be within [minBet, maxBet]");
  }

  if (config.stepSizes.some((step) => step === 0 || step % granularity !== 0)) {
    issue("every step must be a positive multiple of betGranularity");
  }

  if (!config.stepSizes.includes(config.defaultStep)) {
    issue("defaultStep must be one of stepSizes");
  }
});

export type BetConfig = z.infer<typeof BetConfig>;

/** Validated once at startup (fail fast on a broken config file). */
export const betConfig: BetConfig = BetConfig.parse(rawConfig);

export type BetCheck = { ok: true } | { ok: false; message: string };

export function checkBet(config: BetConfig, bet: number): BetCheck {
  if (bet < config.minBet || bet > config.maxBet) {
    return { ok: false, message: `Bet must be between ${config.minBet} and ${config.maxBet}` };
  }

  if (bet % config.betGranularity !== 0) {
    return { ok: false, message: `Bet must be a multiple of ${config.betGranularity}` };
  }

  return { ok: true };
}

/** The math pays whole cents only for multiples of its bet unit; every allowed bet must be one. */
export function checkBetUnit(config: BetConfig, betUnit: number): void {
  if (config.betGranularity % betUnit !== 0) {
    throw new Error(
      `betGranularity (${config.betGranularity}) must be a multiple of the math's bet unit (${betUnit})`,
    );
  }
}
