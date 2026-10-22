import type { Cents, DebugState, Round, SessionId } from "@cb2077/shared";

/** Everything the RGS remembers about a player. Plain JSON so any store can persist it. */
export type SessionData = {
  id: SessionId;
  balance: Cents;
  /** Bet of the last round (or the default bet), restored on reload. */
  bet: Cents;
  /** The math's state for this session (JSON). The RGS stores it without reading it. */
  gameState: unknown;
  /** Most recent rounds, oldest first, capped at `MAX_ROUNDS`. */
  rounds: Round[];
  /** Sequence number of the last round. */
  seq: number;
  debug: DebugState;
  /** When the last connection closed; `null` while a connection is attached. */
  disconnectedAt: number | null;
};

export const MAX_ROUNDS = 100;

/**
 * Persistence for sessions. The RGS calls `set` after every change, so implementations
 * may store copies (e.g. `localStorage`) rather than references.
 */
export interface SessionStore {
  get(id: SessionId): SessionData | undefined;
  set(session: SessionData): void;
  delete(id: SessionId): void;
  list(): SessionData[];
}
