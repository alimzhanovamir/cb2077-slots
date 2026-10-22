import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gameMath } from "@cb2077/math";
import { type GameMath, GameServer, MemorySessionStore, seededRandom } from "@cb2077/rgs";

import { ConnectionLostError, GameClient, ServerError } from "../src/net/GameClient.ts";
import type { TransportFactory } from "../src/net/Transport.ts";
import { cents } from "./fixtures.ts";

/** In-process transport over a real RGS, with switches to simulate network failures. */
function createNetwork(math: GameMath = gameMath) {
  const server = new GameServer({
    math,
    store: new MemorySessionStore(),
    startBalance: 100_000,
    sessionTtlMs: 60_000,
    random: seededRandom(3),
  });

  const network = {
    connections: 0,
    mute: false,
    closeCurrent: () => {
      // Replaced by the transport once a connection opens.
    },
  };

  const transport: TransportFactory = (handlers) => {
    network.connections += 1;

    let open = true;

    const close = () => {
      if (!open) {
        return;
      }

      open = false;
      rgs.onClose();

      setTimeout(() => {
        handlers.onClose();
      }, 0);
    };

    const rgs = server.connect({
      send: (raw) => {
        if (open && !network.mute) {
          setTimeout(() => {
            handlers.onMessage(raw);
          }, 0);
        }
      },
      close,
    });

    network.closeCurrent = close;

    setTimeout(() => {
      handlers.onOpen();
    }, 0);

    return {
      send: (raw) =>
        open &&
        setTimeout(() => {
          rgs.onMessage(raw);
        }, 0),
      close,
    };
  };

  return { network, transport };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GameClient", () => {
  it("initialises a session after connecting", async () => {
    const { transport } = createNetwork();
    const client = new GameClient(transport);
    const ready = vi.fn();

    client.on("ready", ready);

    client.start();
    await vi.runAllTimersAsync();

    expect(client.status).toBe("online");
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({ type: "init", resumed: false }));
  });

  it("resolves requests with their responses and rejects server errors", async () => {
    const { transport } = createNetwork();
    const client = new GameClient(transport);

    client.start();
    await vi.runAllTimersAsync();

    const spin = client.request({ type: "spin", bet: cents(100) });

    await vi.runAllTimersAsync();
    await expect(spin).resolves.toMatchObject({ type: "spin", round: { bet: 100 } });

    const invalid = client.request({ type: "spin", bet: cents(125) });
    const assertion = expect(invalid).rejects.toBeInstanceOf(ServerError);

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("reports the debug state the server pushes after a spin used an override", async () => {
    const { transport } = createNetwork();
    const client = new GameClient(transport);
    const states: unknown[] = [];

    client.on("debugState", (state) => states.push(state));
    client.start();
    await vi.runAllTimersAsync();

    const forced = client.request({ type: "debug.forceNext", preset: "bigWin" });

    await vi.runAllTimersAsync();
    await forced;
    expect(states.at(-1)).toEqual({ forceNext: "bigWin", latencyMs: 0 });

    const spin = client.request({ type: "spin", bet: cents(100) });

    await vi.runAllTimersAsync();
    await spin;
    expect(states.at(-1)).toEqual({ latencyMs: 0 });
  });

  it("reconnects with the same session after the connection drops", async () => {
    const { network, transport } = createNetwork();
    const client = new GameClient(transport);
    const inits: { sessionId: string; resumed: boolean }[] = [];

    client.on("ready", (init) => inits.push(init));

    const disconnected = vi.fn();

    client.on("disconnected", disconnected);

    client.start();
    await vi.runAllTimersAsync();
    network.closeCurrent();
    await vi.runAllTimersAsync();

    expect(disconnected).toHaveBeenCalledOnce();
    expect(network.connections).toBe(2);
    expect(inits).toHaveLength(2);
    expect(inits[1]).toMatchObject({ sessionId: inits[0]?.sessionId, resumed: true });
  });

  it("times out a request, then reconnects", async () => {
    const { network, transport } = createNetwork();
    const client = new GameClient(transport, { requestTimeoutMs: 5000 });

    client.start();
    await vi.runAllTimersAsync();

    network.mute = true;

    const spin = client.request({ type: "spin", bet: cents(100) });
    const assertion = expect(spin).rejects.toBeInstanceOf(ConnectionLostError);

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(client.status).toBe("reconnecting");

    network.mute = false;
    await vi.runAllTimersAsync();
    expect(client.status).toBe("online");
    expect(network.connections).toBe(2);
  });

  it("reports a session the server refuses to start and does not retry", async () => {
    const { network, transport } = createNetwork({
      ...gameMath,
      gameInit: () => {
        throw new Error("Unreadable game state");
      },
    });

    const client = new GameClient(transport);
    const ready = vi.fn();
    const failed = vi.fn();

    client.on("ready", ready);
    client.on("initFailed", failed);
    client.start();
    await vi.runAllTimersAsync();

    expect(ready).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ code: "INTERNAL" }));
    expect(client.status).toBe("failed");
    expect(network.connections).toBe(1);
  });

  it("stops reconnecting when the session is taken over", async () => {
    const { network, transport } = createNetwork();
    const first = new GameClient(transport);
    let sessionId = "";

    first.on("ready", (init) => (sessionId = init.sessionId));

    const replaced = vi.fn();

    first.on("sessionReplaced", replaced);
    first.start();
    await vi.runAllTimersAsync();

    // A "second tab" opens the same session.
    const second = transport({ onOpen: ignore, onMessage: ignore, onClose: ignore });

    second.send(JSON.stringify({ type: "init", requestId: "q-second", sessionId }));
    await vi.runAllTimersAsync();

    expect(replaced).toHaveBeenCalledOnce();
    expect(first.status).toBe("replaced");
    expect(network.connections).toBe(2); // the replaced client did not reconnect
  });
});

function ignore(): void {
  // The event is not checked in this test.
}
