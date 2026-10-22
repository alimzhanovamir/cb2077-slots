import { type RawData, type WebSocket, WebSocketServer } from "ws";

import type { GameServer } from "@cb2077/rgs";

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Exposes a `GameServer` over WebSocket. Every socket becomes an RGS `Connection`;
 * a protocol-level ping every 15s terminates sockets that stopped answering.
 */
export class GameWebSocketServer {
  private readonly webSocketServer: WebSocketServer;
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(game: GameServer, port: number, onListening?: () => void) {
    this.webSocketServer = new WebSocketServer({ port });
    this.webSocketServer.on("listening", () => onListening?.());

    this.webSocketServer.on("connection", (socket) => {
      this.alive.set(socket, true);
      socket.on("pong", () => this.alive.set(socket, true));

      const handler = game.connect({
        send: (raw) => {
          socket.send(raw);
        },
        close: () => {
          socket.close();
        },
      });

      socket.on("message", (data) => {
        handler.onMessage(rawDataToText(data));
      });

      socket.on("close", () => {
        handler.onClose();
      });

      socket.on("error", () => {
        socket.terminate();
      });
    });

    this.heartbeat = setInterval(() => {
      for (const socket of this.webSocketServer.clients) {
        if (this.alive.get(socket) === false) {
          socket.terminate();
          continue;
        }

        this.alive.set(socket, false);
        socket.ping();
      }

      game.cleanupExpired();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Closes all sockets and stops listening. */
  close(): Promise<void> {
    clearInterval(this.heartbeat);

    for (const socket of this.webSocketServer.clients) {
      socket.terminate();
    }

    return new Promise((resolve) => {
      this.webSocketServer.close(() => {
        resolve();
      });
    });
  }
}

function rawDataToText(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  return Buffer.isBuffer(data) ? data.toString("utf8") : Buffer.from(data).toString("utf8");
}
