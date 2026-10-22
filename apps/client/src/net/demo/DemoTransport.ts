import { gameMath } from "@cb2077/math";
import { GameServer } from "@cb2077/rgs";

import type { TransportFactory } from "../Transport.ts";
import { LocalStorageSessionStore } from "./LocalStorageSessionStore.ts";

const START_BALANCE = 100_000;
const SESSION_TTL_MS = 30 * 60_000;

/** Delivers a callback asynchronously, like a network would. */
function later(callback: () => void): void {
  setTimeout(callback, 0);
}

/**
 * In-page emulator (ADR 012): runs the RGS with the game's math inside the browser. Messages are
 * still serialised to JSON and validated on both sides, so the protocol is identical to `ws` mode.
 */
export function createDemoTransport(): TransportFactory {
  const server = new GameServer({
    math: gameMath,
    store: new LocalStorageSessionStore(),
    startBalance: START_BALANCE,
    sessionTtlMs: SESSION_TTL_MS,
  });

  return (handlers) => {
    let open = true;

    const closeClientSide = () => {
      if (!open) {
        return;
      }

      open = false;

      later(() => {
        handlers.onClose();
      });
    };

    const rgs = server.connect({
      // Delivered in order; a close scheduled afterwards arrives after these messages.
      send: (raw) => {
        if (open) {
          later(() => {
            handlers.onMessage(raw);
          });
        }
      },
      // Server-side close (debug "drop connection" or session takeover).
      close: closeClientSide,
    });

    later(() => {
      if (open) {
        handlers.onOpen();
      }
    });

    return {
      send: (raw) => {
        if (open) {
          later(() => {
            rgs.onMessage(raw);
          });
        }
      },
      close: () => {
        rgs.onClose();
        closeClientSide();
      },
    };
  };
}
