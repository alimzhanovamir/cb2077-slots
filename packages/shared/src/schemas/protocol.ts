import { z } from "zod";

import { DebugInfo, DebugState, MAX_LATENCY_MS } from "./debug.ts";
import { PlatformConfig, Round } from "./platform.ts";
import { Cents, ErrorCode, PresetId, RequestId, SessionId } from "./primitives.ts";

// ---------------------------------------------------------------------------
// Client → server
// ---------------------------------------------------------------------------

export const InitRequest = z.object({
  type: z.literal("init"),
  requestId: RequestId,
  sessionId: SessionId.optional(),
});

export const SpinRequest = z.object({
  type: z.literal("spin"),
  requestId: RequestId,
  bet: Cents,
});

export const DebugForceNextRequest = z.object({
  type: z.literal("debug.forceNext"),
  requestId: RequestId,
  preset: PresetId.nullable(),
});

export const DebugFailNextRequest = z.object({
  type: z.literal("debug.failNext"),
  requestId: RequestId,
  code: ErrorCode.nullable(),
});

export const DebugSetLatencyRequest = z.object({
  type: z.literal("debug.setLatency"),
  requestId: RequestId,
  ms: z.number().int().min(0).max(MAX_LATENCY_MS),
});

export const DebugSetBalanceRequest = z.object({
  type: z.literal("debug.setBalance"),
  requestId: RequestId,
  balance: Cents,
});

export const DebugResetBalanceRequest = z.object({
  type: z.literal("debug.resetBalance"),
  requestId: RequestId,
});

export const DebugDropConnectionRequest = z.object({
  type: z.literal("debug.dropConnection"),
  requestId: RequestId,
});

export const ClientMessage = z.discriminatedUnion("type", [
  InitRequest,
  SpinRequest,
  DebugForceNextRequest,
  DebugFailNextRequest,
  DebugSetLatencyRequest,
  DebugSetBalanceRequest,
  DebugResetBalanceRequest,
  DebugDropConnectionRequest,
]);

export type ClientMessage = z.infer<typeof ClientMessage>;
export type ClientMessageType = ClientMessage["type"];
export type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { type: T }>;

// ---------------------------------------------------------------------------
// Server → client
// ---------------------------------------------------------------------------

export const InitResponse = z.object({
  type: z.literal("init"),
  requestId: RequestId,
  sessionId: SessionId,
  /** True when an existing session was restored, false when a new one was created. */
  resumed: z.boolean(),
  balance: Cents,
  /** The last round's bet, or the default bet. */
  bet: Cents,
  config: PlatformConfig,
  lastRound: Round.optional(),
  debug: DebugInfo,
  /** Game payload (`GameInit`): what the game shows on load. Passed through unread. */
  game: z.unknown(),
});

export const SpinResponse = z.object({
  type: z.literal("spin"),
  requestId: RequestId,
  round: Round,
});

/**
 * Answers every debug command. Also pushed without a `requestId` after a spin used up a one-shot
 * override (`forceNext`, `failNext`).
 */
export const DebugStateResponse = z.object({
  type: z.literal("debug.state"),
  requestId: RequestId.optional(),
  state: DebugState,
});

export const ErrorResponse = z.object({
  type: z.literal("error"),
  requestId: RequestId.optional(),
  code: ErrorCode,
  message: z.string(),
});

/** Pushed by the server when the balance changed outside a spin (debug commands). */
export const BalancePush = z.object({
  type: z.literal("balance"),
  balance: Cents,
});

/** Pushed to a connection whose session was taken over by a newer connection. */
export const SessionReplacedPush = z.object({
  type: z.literal("sessionReplaced"),
});

export const ServerMessage = z.discriminatedUnion("type", [
  InitResponse,
  SpinResponse,
  DebugStateResponse,
  ErrorResponse,
  BalancePush,
  SessionReplacedPush,
]);

export type ServerMessage = z.infer<typeof ServerMessage>;
export type ServerMessageType = ServerMessage["type"];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;

export type InitResponse = ServerMessageOf<"init">;
export type SpinResponse = ServerMessageOf<"spin">;
export type DebugStateResponse = ServerMessageOf<"debug.state">;
export type ErrorResponse = ServerMessageOf<"error">;
export type BalancePush = ServerMessageOf<"balance">;
