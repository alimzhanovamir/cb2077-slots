/** Every user-facing text of the game's own UI. System messages are the platform's. */
export const texts = {
  title: "CB2077",
  balance: "BALANCE",
  win: "WIN",
  bet: "BET",
  step: (amount: string) => `STEP ${amount}`,
  spin: "SPIN",
} as const;
