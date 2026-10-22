import { afterEach, describe, expect, it, vi } from "vitest";

import { gameMath } from "@cb2077/math";
import {
  asCents,
  ServerMessage,
  type ServerMessageOf,
  type ServerMessageType,
} from "@cb2077/shared";
import { GameInit, SpinOutcome } from "@cb2077/shared/game";

import type { GameMath } from "../src/GameMath.ts";
import { GameServer, type GameServerOptions } from "../src/GameServer.ts";
import { MemorySessionStore } from "../src/MemorySessionStore.ts";
import { type Random, seededRandom } from "../src/random.ts";
import { MAX_ROUNDS } from "../src/SessionStore.ts";

const START_BALANCE = 100_000;
const TTL_MS = 30 * 60_000;

function createServer(overrides: Partial<GameServerOptions> = {}) {
  let time = 0;
  const store = new MemorySessionStore();

  const server = new GameServer({
    math: gameMath,
    store,
    startBalance: START_BALANCE,
    sessionTtlMs: TTL_MS,
    random: seededRandom(7),
    now: () => time,
    ...overrides,
  });

  return { server, store, advance: (ms: number) => (time += ms) };
}

/** A fake transport connection that records what the RGS sends. */
function connect(server: GameServer) {
  const received: ServerMessage[] = [];
  let closedByServer = false;
  let counter = 0;

  const handler = server.connect({
    send: (raw) => received.push(ServerMessage.parse(JSON.parse(raw))),
    close: () => (closedByServer = true),
  });

  return {
    received,
    get closedByServer() {
      return closedByServer;
    },
    send(message: Record<string, unknown>) {
      counter += 1;

      const requestId = `q${counter}`;

      handler.onMessage(JSON.stringify({ requestId, ...message }));

      return requestId;
    },
    sendRaw: (raw: string) => {
      handler.onMessage(raw);
    },
    close: () => {
      handler.onClose();
    },
    last<T extends ServerMessageType>(type: T): ServerMessageOf<T> {
      const message = received.findLast((candidate) => candidate.type === type);

      if (!message) {
        throw new Error(`No "${type}" message received`);
      }

      // The message was found by its `type`, so it has that type's shape.
      return message as ServerMessageOf<T>;
    },
  };
}

function initNew(server: GameServer) {
  const client = connect(server);

  client.send({ type: "init" });

  return { client, init: client.last("init") };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("init", () => {
  it("creates a new session with the starting balance and default bet", () => {
    const { server } = createServer();
    const { init } = initNew(server);

    expect(init).toMatchObject({ resumed: false, balance: START_BALANCE, bet: 100 });
    expect(init.lastRound).toBeUndefined();
    expect(GameInit.parse(init.game).grid).toHaveLength(5);

    expect(init.config).toMatchObject({
      minBet: 50,
      maxBet: 50_000,
      stepSizes: [50, 100, 200, 500, 1000, 2000, 5000],
    });

    expect(init.debug.presets.map((preset) => preset.id)).toEqual([
      "noWin",
      "smallWin",
      "bigWin",
      "maxWin",
    ]);

    expect(init.debug.state).toEqual({ latencyMs: 0 });
  });

  it("creates a new session when the session id is unknown", () => {
    const { server } = createServer();
    const client = connect(server);

    client.send({ type: "init", sessionId: "s-unknown" });
    expect(client.last("init")).toMatchObject({ resumed: false });
    expect(client.last("init").sessionId).not.toBe("s-unknown");
  });

  it("resumes a session with its balance, bet, grid and last round", () => {
    const { server } = createServer();
    const { client, init } = initNew(server);

    client.send({ type: "spin", bet: 200 });

    const round = client.last("spin").round;

    client.close();

    const again = connect(server);

    again.send({ type: "init", sessionId: init.sessionId });

    const resumed = again.last("init");

    expect(resumed).toMatchObject({
      resumed: true,
      sessionId: init.sessionId,
      balance: round.balance,
      bet: 200,
      lastRound: round,
    });

    expect(GameInit.parse(resumed.game).grid).toEqual(SpinOutcome.parse(round.outcome).grid);
  });

  it("replaces the previous connection of the same session", () => {
    const { server } = createServer();
    const { client: first, init } = initNew(server);

    const second = connect(server);

    second.send({ type: "init", sessionId: init.sessionId });

    expect(first.received.at(-1)).toEqual({ type: "sessionReplaced" });
    expect(first.closedByServer).toBe(true);
    expect(second.last("init").resumed).toBe(true);

    // The replaced connection is dead: further messages are ignored.
    const before = first.received.length;

    first.send({ type: "spin", bet: 100 });
    expect(first.received).toHaveLength(before);
  });
});

describe("spin", () => {
  it("charges the bet, pays the win and returns the round", () => {
    const { server } = createServer();
    const { client } = initNew(server);

    const requestId = client.send({ type: "spin", bet: 100 });
    const { round } = client.last("spin");

    expect(round).toMatchObject({ requestId, seq: 1, bet: 100 });
    expect(round.balance).toBe(START_BALANCE - 100 + round.totalWin);
  });

  it("requires init first", () => {
    const { server } = createServer();
    const client = connect(server);

    client.send({ type: "spin", bet: 100 });
    expect(client.last("error")).toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each([0, 25, 125, 50_050])("rejects an invalid bet of %i without charging", (bet) => {
    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "spin", bet });
    expect(client.last("error").code).toMatch(/INVALID_BET|BAD_REQUEST/);
    client.send({ type: "spin", bet: 100 });

    expect(client.last("spin").round.balance).toBe(
      START_BALANCE - 100 + client.last("spin").round.totalWin,
    );
  });

  it("rejects a bet above the balance", () => {
    const { server } = createServer({ startBalance: 300 });
    const { client } = initNew(server);

    client.send({ type: "spin", bet: 500 });
    expect(client.last("error")).toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("keeps only the last rounds in the session", () => {
    const { server, store } = createServer({ startBalance: 10_000_000 });
    const { client, init } = initNew(server);

    for (let spin = 0; spin < MAX_ROUNDS + 5; spin++) {
      client.send({ type: "spin", bet: 50 });
    }

    const session = store.get(init.sessionId);

    expect(session?.rounds).toHaveLength(MAX_ROUNDS);
    expect(session?.rounds.at(-1)?.seq).toBe(MAX_ROUNDS + 5);
  });

  it("leaves the session unchanged when the round cannot be computed", () => {
    let failing = false;

    const random: Random = {
      nextInt: (max) => {
        if (failing) {
          throw new Error("RNG failure");
        }

        return seededRandom(1).nextInt(max);
      },
    };

    const { server, store } = createServer({ random });
    const { client, init } = initNew(server);
    const before = JSON.parse(JSON.stringify(store.get(init.sessionId))) as unknown;

    failing = true;
    client.send({ type: "spin", bet: 100 });

    expect(client.last("error")).toMatchObject({ code: "INTERNAL" });
    expect(store.get(init.sessionId)).toEqual(before);
  });
});

describe("debug commands", () => {
  it("forceNext applies a preset to exactly one spin", () => {
    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "debug.forceNext", preset: "maxWin" });
    expect(client.last("debug.state").state).toMatchObject({ forceNext: "maxWin" });

    client.send({ type: "spin", bet: 100 });
    expect(client.last("spin").round).toMatchObject({ forced: "maxWin", totalWin: 729_000 });
    // The used-up override is pushed as cleared.
    expect(client.last("debug.state")).toEqual({ type: "debug.state", state: { latencyMs: 0 } });

    client.send({ type: "spin", bet: 100 });
    expect(client.last("spin").round.forced).toBeUndefined();
  });

  it("rejects an unknown preset", () => {
    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "debug.forceNext", preset: "jackpot" });
    expect(client.last("error")).toMatchObject({ code: "BAD_REQUEST" });
  });

  it("failNext fails one spin without charging", () => {
    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "debug.failNext", code: "INTERNAL" });
    client.send({ type: "spin", bet: 100 });
    expect(client.last("error")).toMatchObject({ code: "INTERNAL" });
    expect(client.last("debug.state")).toEqual({ type: "debug.state", state: { latencyMs: 0 } });

    client.send({ type: "debug.forceNext", preset: "noWin" });
    client.send({ type: "spin", bet: 100 });
    expect(client.last("spin").round.balance).toBe(START_BALANCE - 100);
  });

  it("setLatency delays spin responses", () => {
    vi.useFakeTimers();

    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "debug.setLatency", ms: 3000 });
    client.send({ type: "spin", bet: 100 });
    expect(client.received.some((message) => message.type === "spin")).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(client.last("spin").round.bet).toBe(100);
  });

  it("setBalance and resetBalance answer with the state and push the balance", () => {
    const { server } = createServer();
    const { client } = initNew(server);

    client.send({ type: "debug.setBalance", balance: 500 });
    expect(client.last("debug.state")).toBeDefined();
    expect(client.last("balance").balance).toBe(500);

    client.send({ type: "debug.resetBalance" });
    expect(client.last("balance").balance).toBe(START_BALANCE);
  });

  it("dropConnection closes the connection without answering", () => {
    const { server } = createServer();
    const { client } = initNew(server);
    const before = client.received.length;

    client.send({ type: "debug.dropConnection" });

    expect(client.closedByServer).toBe(true);
    expect(client.received).toHaveLength(before);
  });
});

describe("bad input", () => {
  it("answers invalid JSON with BAD_REQUEST", () => {
    const { server } = createServer();
    const client = connect(server);

    client.sendRaw("{not json");
    expect(client.last("error")).toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps the requestId of a schema mismatch", () => {
    const { server } = createServer();
    const client = connect(server);

    client.sendRaw(JSON.stringify({ type: "spin", requestId: "q-bad", bet: "a lot" }));
    expect(client.last("error")).toMatchObject({ code: "BAD_REQUEST", requestId: "q-bad" });
  });
});

describe("session expiry", () => {
  it("keeps a connected session and deletes a disconnected one after the TTL", () => {
    const { server, store, advance } = createServer();
    const { client: connected, init: kept } = initNew(server);
    const { client: leaving, init: dropped } = initNew(server);

    leaving.close();

    advance(TTL_MS + 1);
    server.cleanupExpired();

    expect(store.get(kept.sessionId)).toBeDefined();
    expect(store.get(dropped.sessionId)).toBeUndefined();
    expect(connected.closedByServer).toBe(false);
  });
});

describe("game math", () => {
  /** A math that knows nothing about reels: the RGS must not care. */
  const fakeMath: GameMath = {
    betUnit: asCents(50),
    newState: () => ({ level: 1 }),
    gameInit: (state) => ({ shown: state }),
    play: ({ bet, state }) => ({
      outcome: { anything: "the game decides", previous: state },
      totalWin: bet,
      state: { level: 2 },
    }),
    presets: () => [],
    hasPreset: () => false,
  };

  it("forwards the math's outcome and game init without reading them", () => {
    const { server } = createServer({ math: fakeMath });
    const { client, init } = initNew(server);

    expect(init.game).toEqual({ shown: { level: 1 } });

    client.send({ type: "spin", bet: 100 });

    expect(client.last("spin").round).toMatchObject({
      totalWin: 100,
      balance: START_BALANCE,
      outcome: { anything: "the game decides", previous: { level: 1 } },
    });
  });

  it("refuses to start when the bets do not fit the math's bet unit", () => {
    expect(() => createServer({ math: { ...fakeMath, betUnit: asCents(30) } })).toThrow(/bet unit/);
  });
});
