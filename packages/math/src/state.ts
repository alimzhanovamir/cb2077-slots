import { z } from "zod";

import { Grid } from "@cb2077/shared/game";

/** What the math keeps between rounds of a session. The RGS stores it without reading it. */
export const GameState = z.object({
  /** Grid currently shown to the player, restored on reload. */
  grid: Grid,
});

export type GameState = z.infer<typeof GameState>;
