import { Container, Graphics } from "pixi.js";

import type { SymbolId } from "@cb2077/shared/game";

import { SymbolView } from "../placeholder/SymbolFactory.ts";
import { TIMINGS } from "../theme.ts";

type ReelState =
  | { kind: "idle" }
  | { kind: "spinning" }
  | { kind: "stopping"; queue: SymbolId[]; rotationsLeft: number; resolve: () => void }
  | { kind: "settling"; from: number; elapsed: number; resolve: () => void };

/**
 * One reel: `rows` visible cells plus one buffer cell above. While spinning, the strip scrolls
 * down; every time it moved by one cell, the bottom view is recycled to the top with the next
 * symbol (random, or the target symbols once stopping).
 */
export class Reel extends Container {
  private readonly views: SymbolView[] = [];
  private offset = 0;
  private state: ReelState = { kind: "idle" };

  constructor(
    rows: number,
    cellWidth: number,
    private readonly cellHeight: number,
    private readonly randomSymbol: () => SymbolId,
  ) {
    super();

    const mask = new Graphics().rect(0, 0, cellWidth, cellHeight * rows).fill({ color: 0xffffff });

    this.addChild(mask);
    this.mask = mask;

    for (let index = 0; index <= rows; index++) {
      const view = new SymbolView(cellWidth, cellHeight);

      view.setSymbol(randomSymbol());
      this.views.push(view);
      this.addChild(view);
    }

    this.layout();
  }

  /** Visible symbol views, top to bottom. */
  get cells(): readonly SymbolView[] {
    return this.views.slice(1);
  }

  /** Moves the bottom view to the top and gives it the next symbol. */
  private rotate(next: SymbolId | undefined): void {
    const bottom = this.views.pop();

    if (!bottom) {
      return;
    }

    bottom.setSymbol(next ?? this.randomSymbol());
    this.views.unshift(bottom);
  }

  private layout(): void {
    this.views.forEach((view, index) => {
      view.y = (index - 1) * this.cellHeight + this.offset;
    });
  }

  /** Shows `symbols` (top to bottom) immediately. */
  setSymbols(symbols: readonly SymbolId[]): void {
    this.state = { kind: "idle" };
    this.offset = 0;

    symbols.forEach((symbol, row) => {
      this.views[row + 1]?.setSymbol(symbol);
    });

    this.views[0]?.setSymbol(this.randomSymbol());
    this.layout();
  }

  start(): void {
    this.state = { kind: "spinning" };
  }

  /** Lands on `symbols` (top to bottom). Resolves once the reel has settled. */
  stop(symbols: readonly SymbolId[]): Promise<void> {
    return new Promise((resolve) => {
      if (this.state.kind === "idle") {
        this.setSymbols(symbols);
        resolve();

        return;
      }

      // Symbols enter from the top, so the bottom row has to be queued first.
      this.state = {
        kind: "stopping",
        queue: [...symbols].reverse(),
        rotationsLeft: symbols.length + 1,
        resolve,
      };
    });
  }

  update(deltaMs: number): void {
    const state = this.state;

    if (state.kind === "idle") {
      return;
    }

    if (state.kind === "settling") {
      state.elapsed += deltaMs;

      const progress = Math.min(1, state.elapsed / TIMINGS.reelSettleMs);

      this.offset = state.from * (1 - easeOutBack(progress));
      this.layout();

      if (progress >= 1) {
        this.offset = 0;
        this.layout();
        this.state = { kind: "idle" };
        state.resolve();
      }

      return;
    }

    this.offset += TIMINGS.reelSpeedPxPerMs * deltaMs;

    while (this.offset >= this.cellHeight) {
      this.offset -= this.cellHeight;
      this.rotate(state.kind === "stopping" ? state.queue.shift() : undefined);

      if (state.kind !== "stopping") {
        continue;
      }

      state.rotationsLeft -= 1;

      if (state.rotationsLeft === 0) {
        // Landed: ease the small overshoot back to the rest position.
        this.state = {
          kind: "settling",
          from: Math.min(this.offset, this.cellHeight / 4),
          elapsed: 0,
          resolve: state.resolve,
        };

        break;
      }
    }

    this.layout();
  }
}

/** Easing that slightly overshoots the target and settles back. `progress` goes from 0 to 1. */
function easeOutBack(progress: number): number {
  const overshoot = 1.70158;
  const remaining = progress - 1;

  return 1 + (overshoot + 1) * remaining ** 3 + overshoot * remaining ** 2;
}
