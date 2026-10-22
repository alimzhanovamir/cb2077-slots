import type { GameModel } from "../logic/GameModel.ts";
import type { Bounds, Game } from "../view/Game.ts";

/** Game state as E2E tests see it: plain values only. */
export type SlotTestState = {
  phase: string;
  connection: string;
  balance: number;
  bet: number;
  step: number;
  lastWin: number;
  message: string | null;
  /** What the reels show, as the game reports it; the platform does not read it. */
  grid: unknown;
};

export type SlotTestHook = {
  getState(): SlotTestState;
  /** Screen rectangle of a game control (the game draws on a canvas, so there is no DOM). */
  getBounds(id: string): Bounds | null;
};

declare global {
  interface Window {
    __slot?: SlotTestHook;
  }
}

/** Read-only hook for E2E tests (docs/testing.md): canvas controls have no DOM elements to select. */
export function installTestHook(model: GameModel, game: Game): void {
  window.__slot = {
    getState() {
      const snapshot = model.snapshot();

      return {
        phase: snapshot.phase,
        connection: snapshot.connection,
        balance: snapshot.balance,
        bet: snapshot.bet,
        step: snapshot.step,
        lastWin: snapshot.lastWin,
        message:
          snapshot.message?.code ?? (snapshot.insufficientFunds ? "insufficientFunds" : null),
        grid: game.getVisibleGrid(),
      };
    },
    getBounds: (id) => game.getControlBounds(id),
  };
}
