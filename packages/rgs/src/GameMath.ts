import type { Cents, PresetId, PresetInfo } from "@cb2077/shared";

import type { Random } from "./random.ts";

/** What the RGS hands the math for one paid round. */
export type PlayRequest = {
  bet: Cents;
  /** The session's game state, as the math returned it last time. */
  state: unknown;
  random: Random;
  /** Debug preset to play instead of a random draw. */
  preset: PresetId | undefined;
};

/** One played round. `outcome` and `state` belong to the math: the RGS stores and forwards them. */
export type PlayResult = {
  /** Game payload sent to the client as `Round.outcome`. */
  outcome: unknown;
  totalWin: Cents;
  /** The session's game state after this round. */
  state: unknown;
};

/**
 * A game's math module as the RGS sees it (ADR 014). The RGS never reads the outcome or the game
 * state. Members are function properties, not methods, so an implementation must accept
 * `unknown` and parse it (methods would be checked bivariantly).
 */
export interface GameMath {
  /** Every bet must be a multiple of this so payouts are whole cents. Checked at startup. */
  readonly betUnit: Cents;
  /** Game state of a new session. */
  newState: (random: Random) => unknown;
  /** Game part of `init` (`init.game`) for a session. */
  gameInit: (state: unknown) => unknown;
  play: (request: PlayRequest) => PlayResult;
  presets: () => PresetInfo[];
  hasPreset: (id: PresetId) => boolean;
}
