import { SessionId } from "@cb2077/shared";

import type { Connection } from "./Connection.ts";
import { randomId } from "./random.ts";
import type { SessionData, SessionStore } from "./SessionStore.ts";

/** Per-connection state kept by the RGS. */
export type ConnectionContext = {
  readonly connection: Connection;
  /** Session this connection is attached to, after `init`. */
  sessionId: SessionId | undefined;
  /** Set once the connection is closed by either side; nothing is sent afterwards. */
  closed: boolean;
};

export type SessionManagerOptions = {
  store: SessionStore;
  /** How long a session is kept after its last connection closed. */
  ttlMs: number;
  now: () => number;
};

/**
 * Owns sessions and which connection is attached to each of them. A session has at most one
 * attached connection; attaching a new one returns the connection it replaced.
 */
export class SessionManager {
  private readonly attached = new Map<SessionId, ConnectionContext>();

  constructor(private readonly options: SessionManagerOptions) {}

  get(id: SessionId): SessionData | undefined {
    return this.options.store.get(id);
  }

  save(session: SessionData): void {
    this.options.store.set(session);
  }

  create(initial: Pick<SessionData, "balance" | "bet" | "gameState">): SessionData {
    const session: SessionData = {
      // No casts in the RGS (ADR 014): the id is checked instead.
      id: SessionId.parse(randomId("s")),
      ...initial,
      rounds: [],
      seq: 0,
      debug: { latencyMs: 0 },
      disconnectedAt: null,
    };

    this.save(session);

    return session;
  }

  /** Attaches `context` to the session and returns the previously attached connection, if any. */
  attach(session: SessionData, context: ConnectionContext): ConnectionContext | undefined {
    const previous = this.attached.get(session.id);

    this.attached.set(session.id, context);
    context.sessionId = session.id;

    if (session.disconnectedAt !== null) {
      this.save({ ...session, disconnectedAt: null });
    }

    return previous === context ? undefined : previous;
  }

  /** Detaches `context` if it is still the session's connection; starts the session's expiry. */
  detach(context: ConnectionContext): void {
    const id = context.sessionId;

    if (id === undefined || this.attached.get(id) !== context) {
      return;
    }

    this.attached.delete(id);

    const session = this.get(id);

    if (session) {
      this.save({ ...session, disconnectedAt: this.options.now() });
    }
  }

  /**
   * Deletes sessions disconnected for longer than the TTL. Sessions that are stored as
   * connected but have no live connection here (left over from a reload or a crash) start
   * their expiry now.
   */
  cleanupExpired(): void {
    const now = this.options.now();

    for (const session of this.options.store.list()) {
      if (this.attached.has(session.id)) {
        continue;
      }

      if (session.disconnectedAt === null) {
        this.save({ ...session, disconnectedAt: now });
      } else if (now - session.disconnectedAt > this.options.ttlMs) {
        this.options.store.delete(session.id);
      }
    }
  }
}
