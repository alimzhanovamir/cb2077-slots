import { MemorySessionStore, type SessionData, type SessionStore } from "@cb2077/rgs";
import type { SessionId } from "@cb2077/shared";

/** Bump the version when `SessionData` changes shape: entries in the old shape are then ignored. */
const PREFIX = "cb2077.demo.session.v2.";

/**
 * RGS session store backed by `localStorage`, so the in-browser emulator keeps balances
 * across reloads. Falls back to memory when storage is unavailable.
 */
export class LocalStorageSessionStore implements SessionStore {
  private readonly fallback = new MemorySessionStore();
  private readonly available = storageAvailable();

  get(id: SessionId): SessionData | undefined {
    if (!this.available) {
      return this.fallback.get(id);
    }

    const raw = localStorage.getItem(PREFIX + id);

    // Only `save` writes these keys, so the stored JSON is a `SessionData`.
    return raw === null ? undefined : (JSON.parse(raw) as SessionData);
  }

  set(session: SessionData): void {
    if (!this.available) {
      this.fallback.set(session);

      return;
    }

    try {
      localStorage.setItem(PREFIX + session.id, JSON.stringify(session));
    } catch {
      this.fallback.set(session);
    }
  }

  delete(id: SessionId): void {
    if (!this.available) {
      this.fallback.delete(id);

      return;
    }

    localStorage.removeItem(PREFIX + id);
  }

  list(): SessionData[] {
    if (!this.available) {
      return this.fallback.list();
    }

    const sessions: SessionData[] = [];

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);

      if (key?.startsWith(PREFIX)) {
        // `save` writes the keys as PREFIX + session id.
        const session = this.get(key.slice(PREFIX.length) as SessionId);

        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }
}

function storageAvailable(): boolean {
  try {
    const probe = `${PREFIX}probe`;

    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);

    return true;
  } catch {
    return false;
  }
}
