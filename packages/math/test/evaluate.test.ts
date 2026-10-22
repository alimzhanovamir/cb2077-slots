import { describe, expect, it } from "vitest";

import type { Grid } from "@cb2077/shared/game";

import { mathConfig } from "../src/config.ts";
import { evaluate } from "../src/evaluate.ts";
import { findPreset } from "../src/presets.ts";

const { paytable } = mathConfig;
const COIN_VALUE_AT_1_EUR = 100 / mathConfig.coinsPerBet; // 4 cents

/** Builds a grid from rows as they appear on screen (row-major), which is easier to read. */
function fromRows(rows: string[][]): Grid {
  const [firstRow = []] = rows;

  // Test data: every string in the rows is a symbol id.
  return firstRow.map((_, reel) => rows.map((row) => row[reel])) as Grid;
}

function presetGrid(id: string): Grid {
  const preset = findPreset(id);

  if (!preset) {
    throw new Error(`Unknown preset ${id}`);
  }

  return preset.grid;
}

describe("evaluate (243 ways)", () => {
  it("pays the documented katana example: 3 reels, 2 ways", () => {
    const grid = fromRows([
      ["katana", "chip", "katana", "eddie", "solo"],
      ["chip", "katana", "eddie", "implant", "chip"],
      ["eddie", "katana", "solo", "chip", "eddie"],
    ]);

    const { wins, totalWin } = evaluate(grid, paytable, COIN_VALUE_AT_1_EUR);

    expect(wins).toEqual([
      {
        symbol: "katana",
        reelCount: 3,
        ways: 2,
        payout: 30 * 2 * 4,
        positions: [
          { reel: 0, row: 0 },
          { reel: 1, row: 1 },
          { reel: 1, row: 2 },
          { reel: 2, row: 0 },
        ],
      },
    ]);

    expect(totalWin).toBe(240);
  });

  it("does not pay when a symbol skips a reel", () => {
    const grid = fromRows([
      ["solo", "chip", "solo", "solo", "solo"],
      ["chip", "eddie", "eddie", "implant", "chip"],
      ["eddie", "deck", "pistol", "chip", "eddie"],
    ]);

    expect(
      evaluate(grid, paytable, COIN_VALUE_AT_1_EUR).wins.map((win) => win.symbol),
    ).not.toContain("solo");
  });

  it("pays 4- and 5-reel wins with the matching paytable column", () => {
    const fourReels = fromRows([
      ["pistol", "pistol", "pistol", "pistol", "chip"],
      ["chip", "eddie", "deck", "implant", "eddie"],
      ["eddie", "deck", "implant", "chip", "deck"],
    ]);

    const fiveReels = fromRows([
      ["pistol", "pistol", "pistol", "pistol", "pistol"],
      ["chip", "eddie", "deck", "implant", "eddie"],
      ["eddie", "deck", "implant", "chip", "deck"],
    ]);

    const four = evaluate(fourReels, paytable, 1).wins.find((win) => win.symbol === "pistol");
    const five = evaluate(fiveReels, paytable, 1).wins.find((win) => win.symbol === "pistol");

    expect(four).toMatchObject({ reelCount: 4, ways: 1, payout: paytable.pistol[4] });
    expect(five).toMatchObject({ reelCount: 5, ways: 1, payout: paytable.pistol[5] });
  });

  it("adds up several simultaneous wins", () => {
    const grid = fromRows([
      ["chip", "chip", "chip", "deck", "solo"],
      ["eddie", "eddie", "eddie", "implant", "chip"],
      ["deck", "pistol", "katana", "pistol", "eddie"],
    ]);

    const { wins, totalWin } = evaluate(grid, paytable, 2);

    expect(wins.map((win) => win.symbol).sort()).toEqual(["chip", "eddie"]);
    expect(totalWin).toBe((paytable.chip[3] + paytable.eddie[3]) * 2);
  });

  it("returns integer payouts for every bet that is a multiple of coinsPerBet", () => {
    const grid = presetGrid("bigWin");
    const maxBet = 50_000;

    for (let bet = mathConfig.coinsPerBet; bet <= maxBet; bet += mathConfig.coinsPerBet) {
      const { wins, totalWin } = evaluate(grid, paytable, bet / mathConfig.coinsPerBet);

      expect(Number.isInteger(totalWin)).toBe(true);

      for (const win of wins) {
        expect(Number.isInteger(win.payout)).toBe(true);
      }
    }
  });
});

describe("debug presets", () => {
  const winOf = (id: string) => evaluate(presetGrid(id), paytable, COIN_VALUE_AT_1_EUR);

  it("noWin pays nothing", () => {
    expect(winOf("noWin")).toEqual({ wins: [], totalWin: 0 });
  });

  it("smallWin pays chip on 3 reels, 1 way (€$ 0.60 at €$ 1.00)", () => {
    expect(winOf("smallWin")).toMatchObject({
      wins: [{ symbol: "chip", reelCount: 3, ways: 1 }],
      totalWin: 60,
    });
  });

  it("bigWin pays netrunner on 5 reels, 4 ways (€$ 120.00 at €$ 1.00)", () => {
    expect(winOf("bigWin")).toMatchObject({
      wins: [{ symbol: "netrunner", reelCount: 5, ways: 4 }],
      totalWin: 12_000,
    });
  });

  it("maxWin pays netrunner on all 15 positions, 243 ways (€$ 7 290.00 at €$ 1.00)", () => {
    expect(winOf("maxWin")).toMatchObject({
      wins: [{ symbol: "netrunner", reelCount: 5, ways: 243 }],
      totalWin: 729_000,
    });
  });
});
