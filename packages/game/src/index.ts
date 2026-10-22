import { type GameOptions, GameView } from "./GameView.ts";

/**
 * Starts the game in `options.host` (ADR 014). The game imports nothing from the platform: it gets
 * the money formatter here and the player-action callbacks through `setActions`.
 */
export function createGame(options: GameOptions): Promise<GameView> {
  return GameView.create(options);
}
