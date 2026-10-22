import { describe, expect, it } from "vitest";

import { asCents } from "@cb2077/shared";
import { SpinOutcome } from "@cb2077/shared/game";

import { MathConfig, mathConfig } from "../src/config.ts";
import { gameMath } from "../src/gameMath.ts";
import type { Random } from "../src/random.ts";
import { gridFromStops, randomGrid } from "../src/spin.ts";

/** Deterministic test generator: a fixed sequence that depends only on the start value. */
function sequenceRandom(start: number): Random {
  let current = start;

  return {
    nextInt: (maxExclusive) => {
      current = (current * 31 + 17) % 1_000_003;

      return current % maxExclusive;
    },
  };
}

describe("gridFromStops", () => {
  it("takes three consecutive symbols per reel and wraps around the strip", () => {
    const strips = Array.from({ length: 5 }, () => ["chip", "eddie", "implant", "deck"] as const);
    const grid = gridFromStops(strips, [0, 1, 2, 3, 3]);

    expect(grid[0]).toEqual(["chip", "eddie", "implant"]);
    expect(grid[3]).toEqual(["deck", "chip", "eddie"]);
  });
});

describe("randomGrid", () => {
  it("is deterministic for the same random sequence", () => {
    const first = randomGrid(mathConfig.reelStrips, sequenceRandom(42));
    const second = randomGrid(mathConfig.reelStrips, sequenceRandom(42));

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);

    for (const column of first) {
      expect(column).toHaveLength(3);
    }
  });
});

describe("MathConfig validation", () => {
  it("accepts the shipped config", () => {
    expect(() => MathConfig.parse(mathConfig)).not.toThrow();
  });

  it("rejects a reel strip shorter than the visible rows", () => {
    const reelStrips = mathConfig.reelStrips.map((strip, reel) =>
      reel === 0 ? strip.slice(0, 2) : strip,
    );

    expect(() => MathConfig.parse({ ...mathConfig, reelStrips })).toThrow();
  });
});

describe("gameMath", () => {
  it("bets in multiples of coinsPerBet", () => {
    expect(gameMath.betUnit).toBe(mathConfig.coinsPerBet);
  });

  it("describes a new session with the layout, the symbols and its grid", () => {
    const state = gameMath.newState(sequenceRandom(1));

    expect(gameMath.gameInit(state)).toMatchObject({
      reels: 5,
      rows: 3,
      symbols: expect.arrayContaining(["chip", "netrunner"]) as unknown,
      grid: state.grid,
    });
  });

  it("rejects a session state it did not produce", () => {
    expect(() => gameMath.gameInit({ grid: "broken" })).toThrow();
  });

  it("plays a preset round: its grid, its wins and the new state", () => {
    const result = gameMath.play({
      bet: asCents(100),
      random: sequenceRandom(1),
      preset: "bigWin",
    });

    const outcome = SpinOutcome.parse(result.outcome);

    expect(result.totalWin).toBe(12_000);
    expect(outcome.wins).toHaveLength(1);
    expect(result.state.grid).toEqual(outcome.grid);
  });

  it("lists its presets and knows their ids", () => {
    expect(gameMath.presets().map((preset) => preset.id)).toEqual([
      "noWin",
      "smallWin",
      "bigWin",
      "maxWin",
    ]);

    expect(gameMath.hasPreset("maxWin")).toBe(true);
    expect(gameMath.hasPreset("jackpot")).toBe(false);
  });
});
