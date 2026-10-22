import { describe, expect, it } from "vitest";

import { nextStep, sanitizeBet, sanitizeStep, stepBet } from "../src/logic/betRules.ts";
import { cents, CONFIG } from "./fixtures.ts";

describe("stepBet", () => {
  it("adds and subtracts the selected step", () => {
    expect(stepBet(cents(350), cents(200), 1, CONFIG)).toBe(550);
    expect(stepBet(cents(350), cents(200), -1, CONFIG)).toBe(150);
  });

  it("clamps to the minimum and maximum bet", () => {
    expect(stepBet(cents(150), cents(200), -1, CONFIG)).toBe(50);
    expect(stepBet(cents(49_000), cents(5000), 1, CONFIG)).toBe(50_000);
  });
});

describe("nextStep", () => {
  it("cycles through the step sizes", () => {
    expect(nextStep(cents(50), CONFIG.stepSizes)).toBe(100);
    expect(nextStep(cents(5000), CONFIG.stepSizes)).toBe(50);
  });
});

describe("sanitize", () => {
  it("keeps a valid bet and replaces an invalid one", () => {
    expect(sanitizeBet(350, cents(100), CONFIG)).toBe(350);
    expect(sanitizeBet(125, cents(100), CONFIG)).toBe(100);
    expect(sanitizeBet(90_000, cents(100), CONFIG)).toBe(100);
  });

  it("keeps a known step and falls back to the default step", () => {
    expect(sanitizeStep(2000, CONFIG)).toBe(2000);
    expect(sanitizeStep(300, CONFIG)).toBe(100);
    expect(sanitizeStep(undefined, CONFIG)).toBe(100);
  });
});
