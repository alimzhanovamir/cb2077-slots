import type { SessionId } from "@cb2077/shared";

import type { SessionData, SessionStore } from "./SessionStore.ts";

/** In-memory store: used by the Node.js server and tests. Lost on restart. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<SessionId, SessionData>();

  get(id: SessionId): SessionData | undefined {
    return this.sessions.get(id);
  }

  set(session: SessionData): void {
    this.sessions.set(session.id, session);
  }

  delete(id: SessionId): void {
    this.sessions.delete(id);
  }

  list(): SessionData[] {
    return [...this.sessions.values()];
  }
}
