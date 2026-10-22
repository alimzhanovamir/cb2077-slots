import { asCents, type Cents, type PresetId, type PresetInfo } from "@cb2077/shared";
import { type GameInit, REELS, ROWS, type SpinOutcome, SYMBOL_IDS } from "@cb2077/shared/game";

import { mathConfig } from "./config.ts";
import { evaluate } from "./evaluate.ts";
import { findPreset, presetInfos } from "./presets.ts";
import type { Random } from "./random.ts";
import { randomGrid } from "./spin.ts";
import { GameState } from "./state.ts";

/** One paid round. The session's state is not needed: every round is drawn anew. */
export type PlayRequest = {
  bet: Cents;
  random: Random;
  /** Debug preset to play instead of a random draw. */
  preset: PresetId | undefined;
};

export type PlayResult = {
  outcome: SpinOutcome;
  totalWin: Cents;
  state: GameState;
};

/**
 * CB2077's math module. It satisfies the RGS's `GameMath` contract by shape, without importing
 * it (ADR 014): the RGS passes the session state and gets back an outcome it does not read.
 */
export const gameMath = {
  /** A coin must be a whole number of cents, so bets are multiples of `coinsPerBet`. */
  betUnit: asCents(mathConfig.coinsPerBet),

  newState(random: Random): GameState {
    return { grid: randomGrid(mathConfig.reelStrips, random) };
  },

  /** `init.game` for a session: the layout, the symbols and the grid to show. */
  gameInit(state: unknown): GameInit {
    const { grid } = GameState.parse(state);

    return { reels: REELS, rows: ROWS, symbols: [...SYMBOL_IDS], grid };
  },

  /** One paid round: a random grid (or a debug preset) evaluated with the 243-ways rules. */
  play(request: PlayRequest): PlayResult {
    const preset = request.preset === undefined ? undefined : findPreset(request.preset);
    const grid = preset ? preset.grid : randomGrid(mathConfig.reelStrips, request.random);

    const { wins, totalWin } = evaluate(
      grid,
      mathConfig.paytable,
      request.bet / mathConfig.coinsPerBet,
    );

    return { outcome: { grid, wins }, totalWin, state: { grid } };
  },

  presets(): PresetInfo[] {
    return presetInfos();
  },

  hasPreset(id: PresetId): boolean {
    return findPreset(id) !== undefined;
  },
};
