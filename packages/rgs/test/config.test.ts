import { describe, expect, it } from "vitest";

import { BetConfig, betConfig, checkBet } from "../src/config.ts";

describe("checkBet", () => {
  it("accepts bets in range that are multiples of the granularity", () => {
    expect(checkBet(betConfig, 50)).toEqual({ ok: true });
    expect(checkBet(betConfig, 350)).toEqual({ ok: true });
    expect(checkBet(betConfig, 50_000)).toEqual({ ok: true });
  });

  it("rejects bets out of range or with wrong granularity", () => {
    expect(checkBet(betConfig, 0).ok).toBe(false);
    expect(checkBet(betConfig, 50_050).ok).toBe(false);
    expect(checkBet(betConfig, 125).ok).toBe(false);
  });
});

describe("BetConfig validation", () => {
  it("accepts the shipped config", () => {
    expect(() => BetConfig.parse(betConfig)).not.toThrow();
  });

  it("rejects a step that is not a multiple of the granularity", () => {
    expect(() => BetConfig.parse({ ...betConfig, stepSizes: [50, 75] })).toThrow(/multiple/);
  });
});
