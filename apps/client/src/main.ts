import "./styles.css";

import { createGame } from "@cb2077/game";

import { GameController } from "./app/GameController.ts";
import { installTestHook } from "./app/testHook.ts";
import { DebugDrawer } from "./debug/DebugDrawer.ts";
import { GameModel } from "./logic/GameModel.ts";
import { GameClient } from "./net/GameClient.ts";
import type { TransportFactory } from "./net/Transport.ts";
import { createWebSocketTransport } from "./net/WebSocketTransport.ts";
import { formatMoney } from "./view/format/money.ts";
import type { Game } from "./view/Game.ts";
import { SystemLayer } from "./view/SystemLayer.ts";
import { showVersion } from "./view/VersionLabel.ts";

async function createTransport(): Promise<TransportFactory> {
  if (import.meta.env.VITE_TRANSPORT === "demo") {
    // Loaded on demand so the RGS and the math are not bundled into `ws` builds (ADR 012).
    const { createDemoTransport } = await import("./net/demo/DemoTransport.ts");

    console.info("Transport: demo (in-page emulator)");

    return createDemoTransport();
  }

  const url = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:8080`;

  console.info(`Transport: ws (${url})`);

  return createWebSocketTransport(url);
}

async function main(): Promise<void> {
  const host = document.getElementById("game");

  if (!host) {
    throw new Error("The #game element is missing from index.html");
  }

  showVersion(document.body, import.meta.env.VITE_APP_VERSION);

  const client = new GameClient(await createTransport());
  const model = new GameModel({ preferredStep: GameController.preferredStep() });

  // The game imports nothing from the platform; this annotation checks it against the contract
  // by shape (ADR 014). A missing or mistyped member fails `pnpm typecheck` here.
  const game: Game = await createGame({
    host,
    formatMoney: (amount) => formatMoney(amount, model.currency),
  });

  const systemLayer = new SystemLayer(document.body);

  new DebugDrawer(document.body, client);
  installTestHook(model, game);
  new GameController(model, game, client, systemLayer).start();
}

main().catch((error: unknown) => {
  console.error("Failed to start the game:", error);
});
