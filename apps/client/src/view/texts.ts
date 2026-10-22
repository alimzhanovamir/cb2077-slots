/** Every user-facing text of the platform: system windows and notices. The game has its own. */
export const texts = {
  /** Header labels of the system windows and notices. */
  labels: {
    connection: "Connection",
    session: "Session",
    error: "Error",
    notice: "Notice",
  },
  close: "Close",

  connecting: "Connecting…",
  reconnecting: "Connection lost. Reconnecting…",
  sessionReplaced: "Game opened in another window",
  playHere: "Play here",
  startFailed: "The game could not be started. Reload the page to try again.",

  insufficientFunds: "Insufficient funds",
  sessionReset: "Session reset. A new session was started.",
  spinNotPlayed: "Connection lost before the spin was played. Your bet was not charged.",
  presentationFailed: "The round could not be shown. Reload the game to see it.",
  spinErrors: {
    INSUFFICIENT_FUNDS: "Insufficient funds",
    INVALID_BET: "Invalid bet",
    BAD_REQUEST: "Request rejected by the server",
    INTERNAL: "Server error. Your bet was not charged.",
  },
} as const;
