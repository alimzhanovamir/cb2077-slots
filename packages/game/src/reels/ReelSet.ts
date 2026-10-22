import { Container, Graphics } from "pixi.js";

import type { Grid, Position, SymbolId } from "@cb2077/shared/game";

import type { Clock } from "../Clock.ts";
import { COLORS, REEL_LAYOUT, TIMINGS } from "../theme.ts";
import { Reel } from "./Reel.ts";

/** All reels plus their frame. Grid is `grid[reel][row]`. */
export class ReelSet extends Container {
  private readonly reels: Reel[] = [];
  private symbolPool: readonly SymbolId[] = ["chip"];

  constructor(
    reelCount: number,
    rows: number,
    private readonly clock: Clock,
  ) {
    super();

    const { cellWidth, cellHeight, gap } = REEL_LAYOUT;
    const width = reelCount * cellWidth + (reelCount - 1) * gap;
    const height = rows * cellHeight;

    const frame = new Graphics()
      .roundRect(-14, -14, width + 28, height + 28, 16)
      .fill({ color: COLORS.panel })
      .stroke({ width: 2, color: COLORS.cyan, alpha: 0.6 });

    this.addChild(frame);

    for (let index = 0; index < reelCount; index++) {
      const reel = new Reel(rows, cellWidth, cellHeight, () => this.randomSymbol());

      reel.x = index * (cellWidth + gap);
      this.reels.push(reel);
      this.addChild(reel);
    }
  }

  get areaWidth(): number {
    const { cellWidth, gap } = REEL_LAYOUT;

    return this.reels.length * cellWidth + (this.reels.length - 1) * gap;
  }

  private randomSymbol(): SymbolId {
    // Cosmetic filler only: outcomes always come from the server.
    return this.symbolPool[Math.floor(Math.random() * this.symbolPool.length)] ?? "chip";
  }

  /** Symbols used as random filler while spinning. */
  setSymbolPool(symbols: readonly SymbolId[]): void {
    if (symbols.length > 0) {
      this.symbolPool = symbols;
    }
  }

  setGrid(grid: Grid): void {
    this.clearWins();
    grid.forEach((column, reel) => this.reels[reel]?.setSymbols(column));
  }

  start(): void {
    this.clearWins();

    for (const reel of this.reels) {
      reel.start();
    }
  }

  /** Stops the reels one after another, left to right. */
  async stop(grid: Grid): Promise<void> {
    const landed: Promise<void>[] = [];

    for (const [index, reel] of this.reels.entries()) {
      const column = grid[index];

      if (!column) {
        continue;
      }

      if (index > 0) {
        await this.clock.wait(TIMINGS.reelStopDelayMs);
      }

      landed.push(reel.stop(column));
    }

    await Promise.all(landed);
  }

  update(deltaMs: number): void {
    for (const reel of this.reels) {
      reel.update(deltaMs);
    }
  }

  highlight(positions: readonly Position[]): void {
    const winning = new Set(positions.map(({ reel, row }) => `${reel}:${row}`));

    this.reels.forEach((reel, reelIndex) => {
      reel.cells.forEach((view, row) => {
        const isWin = winning.has(`${reelIndex}:${row}`);

        view.setHighlighted(isWin);
        view.setDimmed(!isWin);
      });
    });
  }

  clearWins(): void {
    for (const reel of this.reels) {
      for (const view of reel.cells) {
        view.setHighlighted(false);
        view.setDimmed(false);
      }
    }
  }
}
