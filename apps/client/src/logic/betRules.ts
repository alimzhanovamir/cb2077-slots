import { asCents, type Cents, type PlatformConfig } from "@cb2077/shared";

export type BetLimits = Pick<
  PlatformConfig,
  "minBet" | "maxBet" | "betGranularity" | "stepSizes" | "defaultStep"
>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Adds (+1) or subtracts (−1) the step and clamps the result to `[minBet, maxBet]`. */
export function stepBet(bet: Cents, step: Cents, direction: 1 | -1, limits: BetLimits): Cents {
  return asCents(clamp(bet + direction * step, limits.minBet, limits.maxBet));
}

/** The step after `current` in `stepSizes`, wrapping around. */
export function nextStep(current: Cents, stepSizes: readonly Cents[]): Cents {
  const index = stepSizes.indexOf(current);

  return stepSizes[(index + 1) % stepSizes.length] ?? current;
}

/** A valid bet: within limits and a multiple of the granularity; otherwise `fallback`. */
export function sanitizeBet(bet: number, fallback: Cents, limits: BetLimits): Cents {
  const valid = bet >= limits.minBet && bet <= limits.maxBet && bet % limits.betGranularity === 0;

  return valid ? asCents(bet) : fallback;
}

/** A valid step: one of `stepSizes`; otherwise the default step. */
export function sanitizeStep(step: number | undefined, limits: BetLimits): Cents {
  return limits.stepSizes.find((candidate) => candidate === step) ?? limits.defaultStep;
}
