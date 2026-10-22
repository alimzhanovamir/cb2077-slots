import { asCents, ClientMessage, decodeMessage } from "@cb2077/shared";

import { type BetConfig, betConfig, checkBetUnit } from "./config.ts";
import type { Connection, ConnectionHandler } from "./Connection.ts";
import type { GameMath } from "./GameMath.ts";
import { handleMessage, type HandlerDependencies, type Logger, sendError } from "./handlers.ts";
import { cryptoRandom, type Random } from "./random.ts";
import { type ConnectionContext, SessionManager } from "./SessionManager.ts";
import type { SessionStore } from "./SessionStore.ts";

export type GameServerOptions = {
  /** The game's math module (ADR 014). */
  math: GameMath;
  store: SessionStore;
  /** Balance of a new session, in cents. */
  startBalance: number;
  /** How long a session is kept after its last connection closed. */
  sessionTtlMs: number;
  config?: BetConfig;
  random?: Random;
  now?: () => number;
  log?: Logger;
};

/**
 * The RGS: transport-agnostic and game-agnostic. Each transport wraps its channel into a
 * `Connection` and feeds incoming messages and close events into the returned handler; the
 * game's rules come from the `GameMath` it is given.
 */
export class GameServer {
  private readonly dependencies: HandlerDependencies;
  private readonly sessions: SessionManager;

  constructor(options: GameServerOptions) {
    const now = options.now ?? (() => Date.now());
    const config = options.config ?? betConfig;

    checkBetUnit(config, options.math.betUnit);

    this.sessions = new SessionManager({ store: options.store, ttlMs: options.sessionTtlMs, now });

    this.dependencies = {
      config,
      math: options.math,
      sessions: this.sessions,
      random: options.random ?? cryptoRandom,
      startBalance: asCents(options.startBalance),
      now,
      log: options.log ?? ignoreLog,
    };
  }

  private receive(context: ConnectionContext, raw: string): void {
    if (context.closed) {
      return;
    }

    const decoded = decodeMessage(ClientMessage, raw);

    if (!decoded.ok) {
      sendError(context, decoded.requestId, "BAD_REQUEST", decoded.error);

      return;
    }

    try {
      handleMessage(this.dependencies, context, decoded.value);
    } catch (error) {
      this.dependencies.log("error", {
        message: error instanceof Error ? error.message : String(error),
      });

      sendError(context, decoded.value.requestId, "INTERNAL", "Internal server error");
    }
  }

  connect(connection: Connection): ConnectionHandler {
    this.sessions.cleanupExpired();

    const context: ConnectionContext = { connection, sessionId: undefined, closed: false };

    return {
      onMessage: (raw) => {
        this.receive(context, raw);
      },
      onClose: () => {
        context.closed = true;
        this.sessions.detach(context);
      },
    };
  }

  /** Deletes expired sessions. Also runs on every new connection. */
  cleanupExpired(): void {
    this.sessions.cleanupExpired();
  }
}

function ignoreLog(): void {
  // Logging is off unless a logger is passed in the options.
}
