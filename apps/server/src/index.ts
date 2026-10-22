import { gameMath } from "@cb2077/math";
import { GameServer, MemorySessionStore } from "@cb2077/rgs";

import { readEnvironment } from "./environment.ts";
import { GameWebSocketServer } from "./GameWebSocketServer.ts";

const MILLISECONDS_PER_MINUTE = 60_000;

const environment = readEnvironment();

const game = new GameServer({
  math: gameMath,
  store: new MemorySessionStore(),
  startBalance: environment.START_BALANCE,
  sessionTtlMs: environment.SESSION_TTL_MIN * MILLISECONDS_PER_MINUTE,
  log: (event, data) => {
    console.log(`[${event}]`, JSON.stringify(data));
  },
});

const server = new GameWebSocketServer(game, environment.PORT, () => {
  console.log(`Game server listening on ws://localhost:${environment.PORT}`);
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received, closing server`);

  server
    .close()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to close the server:", error);
      process.exit(1);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
