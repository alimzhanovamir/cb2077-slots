import type { Cents } from "@cb2077/shared";

/**
 * The contract between the platform and a game (ADR 014). The game implements it by shape and
 * imports nothing from the platform; `main.ts` checks the match. Members are function
 * properties, not methods: TypeScript checks method parameters bivariantly, so a game could
 * then declare `presentRound(outcome: SpinOutcome)` and skip validating its `unknown` input.
 */

/** What the platform gives the game when it starts. */
export type GameOptions = {
  /** Element the game puts its canvas into; the game takes its size. */
  host: HTMLElement;
  /** Formats integer cents in the session's currency (the currency is the platform's). */
  formatMoney: (amount: number) => string;
};

/** What the player did in the game's UI. The platform decides what follows. */
export type PlayerActions = {
  spinPressed: () => void;
  betUp: () => void;
  betDown: () => void;
  stepPressed: () => void;
};

/** The game's bottom panel: amounts in cents and which controls are enabled. */
export type HudState = {
  balance: Cents;
  bet: Cents;
  step: Cents;
  win: Cents;
  spinEnabled: boolean;
  betEnabled: boolean;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface Game {
  setActions: (actions: PlayerActions) => void;
  /** `init.game`, unread by the platform: what to show when the session (re)starts. */
  show: (game: unknown) => void;
  update: (state: HudState) => void;
  /** The reels start as soon as the player spins, before the round arrives. */
  startSpin: () => void;
  /**
   * `Round.outcome`, unread by the platform. The game owns the whole presentation (stops, wins,
   * later features) and resolves when it is over.
   */
  presentRound: (outcome: unknown, summary: { totalWin: Cents }) => Promise<void>;
  /** The spin was not played or failed: stop on the grid shown before it. */
  abortSpin: () => Promise<void>;
  /** A platform window covers the game: its animation and its time stop. */
  pause: () => void;
  resume: () => void;
  /** Screen rectangle of a game control, for E2E tests. */
  getControlBounds: (id: string) => Bounds | null;
  /** What the reels show, for E2E tests; passed through unread. */
  getVisibleGrid: () => unknown;
}
