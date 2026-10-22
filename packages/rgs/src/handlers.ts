import {
  asCents,
  type Cents,
  type ClientMessage,
  type ClientMessageOf,
  encodeMessage,
  type ErrorCode,
  type RequestId,
  type Round,
  RoundId,
  type ServerMessage,
} from "@cb2077/shared";

import { type BetConfig, checkBet } from "./config.ts";
import type { GameMath } from "./GameMath.ts";
import { type Random, randomId } from "./random.ts";
import type { ConnectionContext, SessionManager } from "./SessionManager.ts";
import { MAX_ROUNDS, type SessionData } from "./SessionStore.ts";

export type Logger = (event: string, data: Record<string, unknown>) => void;

export type HandlerDependencies = {
  config: BetConfig;
  math: GameMath;
  sessions: SessionManager;
  random: Random;
  startBalance: Cents;
  now: () => number;
  log: Logger;
};

export function send(context: ConnectionContext, message: ServerMessage, delayMs = 0): void {
  const deliver = () => {
    if (!context.closed) {
      context.connection.send(encodeMessage(message));
    }
  };

  if (delayMs > 0) {
    setTimeout(deliver, delayMs);
  } else {
    deliver();
  }
}

export function sendError(
  context: ConnectionContext,
  requestId: RequestId | undefined,
  code: ErrorCode,
  message: string,
  delayMs = 0,
): void {
  // An undefined `requestId` is dropped by JSON serialisation.
  send(context, { type: "error", requestId, code, message }, delayMs);
}

/** Closes a connection from the server side and detaches it from its session. */
function closeConnection(dependencies: HandlerDependencies, context: ConnectionContext): void {
  if (context.closed) {
    return;
  }

  context.closed = true;
  dependencies.sessions.detach(context);
  context.connection.close();
}

export function handleMessage(
  dependencies: HandlerDependencies,
  context: ConnectionContext,
  message: ClientMessage,
): void {
  if (message.type === "init") {
    handleInit(dependencies, context, message);

    return;
  }

  const session = context.sessionId && dependencies.sessions.get(context.sessionId);

  if (!session) {
    sendError(context, message.requestId, "BAD_REQUEST", "Send init first");

    return;
  }

  switch (message.type) {
    case "spin":
      handleSpin(dependencies, context, session, message);

      return;
    case "debug.forceNext":
      if (message.preset !== null && !dependencies.math.hasPreset(message.preset)) {
        sendError(context, message.requestId, "BAD_REQUEST", `Unknown preset "${message.preset}"`);

        return;
      }

      updateDebug(dependencies, context, session, message.requestId, {
        forceNext: message.preset ?? undefined,
      });

      return;
    case "debug.failNext":
      updateDebug(dependencies, context, session, message.requestId, {
        failNext: message.code ?? undefined,
      });

      return;
    case "debug.setLatency":
      updateDebug(dependencies, context, session, message.requestId, { latencyMs: message.ms });

      return;
    case "debug.setBalance":
      setBalance(dependencies, context, session, message.requestId, message.balance);

      return;
    case "debug.resetBalance":
      setBalance(dependencies, context, session, message.requestId, dependencies.startBalance);

      return;
    case "debug.dropConnection":
      closeConnection(dependencies, context);

      return;
  }
}

function handleInit(
  dependencies: HandlerDependencies,
  context: ConnectionContext,
  message: ClientMessageOf<"init">,
): void {
  const { config, math, sessions, random } = dependencies;
  const existing = message.sessionId === undefined ? undefined : sessions.get(message.sessionId);

  const session =
    existing ??
    sessions.create({
      balance: dependencies.startBalance,
      bet: config.defaultBet,
      gameState: math.newState(random),
    });

  // Before attaching: if the math rejects the stored state, nothing has changed yet.
  const game = math.gameInit(session.gameState);

  if (context.sessionId !== undefined && context.sessionId !== session.id) {
    sessions.detach(context);
  }

  const replaced = sessions.attach(session, context);

  if (replaced) {
    send(replaced, { type: "sessionReplaced" });
    replaced.closed = true;
    replaced.connection.close();
  }

  send(context, {
    type: "init",
    requestId: message.requestId,
    sessionId: session.id,
    resumed: existing !== undefined,
    balance: session.balance,
    bet: session.bet,
    config,
    lastRound: session.rounds.at(-1),
    debug: { presets: math.presets(), state: session.debug },
    game,
  });
}

function handleSpin(
  dependencies: HandlerDependencies,
  context: ConnectionContext,
  session: SessionData,
  message: ClientMessageOf<"spin">,
): void {
  const startedAt = dependencies.now();
  const { config, math } = dependencies;
  const { requestId, bet } = message;
  const { latencyMs, failNext, forceNext } = session.debug;

  const betCheck = checkBet(config, bet);

  if (!betCheck.ok) {
    sendError(context, requestId, "INVALID_BET", betCheck.message, latencyMs);

    return;
  }

  if (failNext) {
    const debug = { ...session.debug, failNext: undefined };

    dependencies.sessions.save({ ...session, debug });
    sendError(context, requestId, failNext, "Forced by the debug menu", latencyMs);
    // The one-shot override is used up; the debug drawer shows the state the server confirms.
    send(context, { type: "debug.state", state: debug }, latencyMs);

    return;
  }

  if (bet > session.balance) {
    sendError(context, requestId, "INSUFFICIENT_FUNDS", "Bet exceeds balance", latencyMs);

    return;
  }

  // Compute the whole round first; the session changes only after everything succeeded.
  const preset = forceNext !== undefined && math.hasPreset(forceNext) ? forceNext : undefined;

  const played = math.play({
    bet,
    state: session.gameState,
    random: dependencies.random,
    preset,
  });

  const { totalWin } = played;
  const seq = session.seq + 1;
  const debug = { ...session.debug, forceNext: undefined };

  const round: Round = {
    // No casts where rounds are built (ADR 014): the id is checked instead.
    roundId: RoundId.parse(randomId("r")),
    seq,
    requestId,
    bet,
    totalWin,
    balance: asCents(session.balance - bet + totalWin),
    forced: preset,
    // The game's payload, forwarded unread (ADR 014).
    outcome: played.outcome,
  };

  dependencies.sessions.save({
    ...session,
    balance: round.balance,
    bet,
    gameState: played.state,
    seq,
    rounds: [...session.rounds, round].slice(-MAX_ROUNDS),
    debug,
  });

  dependencies.log("spin", {
    sessionId: session.id,
    roundId: round.roundId,
    bet,
    totalWin,
    forced: round.forced,
    handledMs: dependencies.now() - startedAt,
  });

  send(context, { type: "spin", requestId, round }, latencyMs);

  if (forceNext !== undefined) {
    send(context, { type: "debug.state", state: debug }, latencyMs);
  }
}

function updateDebug(
  dependencies: HandlerDependencies,
  context: ConnectionContext,
  session: SessionData,
  requestId: RequestId,
  patch: Partial<SessionData["debug"]>,
): void {
  const debug = { ...session.debug, ...patch };

  dependencies.sessions.save({ ...session, debug });
  send(context, { type: "debug.state", requestId, state: debug });
}

function setBalance(
  dependencies: HandlerDependencies,
  context: ConnectionContext,
  session: SessionData,
  requestId: RequestId,
  balance: Cents,
): void {
  dependencies.sessions.save({ ...session, balance });
  send(context, { type: "debug.state", requestId, state: session.debug });
  send(context, { type: "balance", balance });
}
