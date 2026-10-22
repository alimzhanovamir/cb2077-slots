import {
  type BalancePush,
  type ClientMessage,
  type DebugState,
  decodeMessage,
  encodeMessage,
  type ErrorCode,
  type InitResponse,
  type RequestId,
  ServerMessage,
  type ServerMessageOf,
  type ServerMessageType,
  SessionId,
} from "@cb2077/shared";

import { Emitter } from "../util/Emitter.ts";
import { logUnexpectedError } from "../util/errors.ts";
import { safeStorage } from "../util/storage.ts";
import { newRequestId } from "./ids.ts";
import type { TransportConnection, TransportFactory } from "./Transport.ts";

/** The server answered a request with an `error` message. */
export class ServerError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerError";
  }
}

/** The connection closed or timed out before the response arrived. */
export class ConnectionLostError extends Error {
  constructor(message = "Connection lost") {
    super(message);
    this.name = "ConnectionLostError";
  }
}

export type ConnectionStatus =
  "idle" | "connecting" | "online" | "reconnecting" | "replaced" | "failed";

export type GameClientEvents = {
  /** A session is ready (first connect, reconnect, or after a reset). */
  ready: InitResponse;
  /** The connection was lost; the client is reconnecting. */
  disconnected: undefined;
  /** Another tab took over the session; the client will not reconnect by itself. */
  sessionReplaced: undefined;
  /** The server refused to start the session; the client will not retry by itself. */
  initFailed: ServerError;
  /** The server pushed a new balance (after a debug command). */
  balance: BalancePush["balance"];
  /** Debug state confirmed by the server. */
  debugState: DebugState;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A client message without its `requestId` (added by the client). */
export type OutgoingMessage = DistributiveOmit<ClientMessage, "requestId">;
type OutgoingRequest = Exclude<OutgoingMessage, { type: "debug.dropConnection" }>;

type RequestType = OutgoingRequest["type"];

/** The response type of every request. */
const RESPONSE_TYPES = {
  init: "init",
  spin: "spin",
  "debug.forceNext": "debug.state",
  "debug.failNext": "debug.state",
  "debug.setLatency": "debug.state",
  "debug.setBalance": "debug.state",
  "debug.resetBalance": "debug.state",
} as const satisfies Record<RequestType, ServerMessageType>;

type ResponseOf<T extends RequestType> = ServerMessageOf<(typeof RESPONSE_TYPES)[T]>;

type Pending = {
  resolve(message: ServerMessage): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

export type GameClientOptions = {
  requestTimeoutMs?: number;
  backoffMs?: readonly number[];
  sessionStorageKey?: string;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_SESSION_STORAGE_KEY = "cb2077.sessionId";
const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
const MAX_BACKOFF_MS = 10_000;

/**
 * Request/response on top of a `Transport`: correlates responses by `requestId`, times out
 * requests, reconnects with backoff and (re)initialises the session after every connect.
 */
export class GameClient extends Emitter<GameClientEvents> {
  private connection: TransportConnection | undefined;
  private generation = 0;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly pending = new Map<RequestId, Pending>();
  private currentStatus: ConnectionStatus = "idle";
  /** Kept in memory as well, so reconnects work even when `localStorage` is unavailable. */
  private sessionId: SessionId | undefined;

  private readonly requestTimeoutMs: number;
  private readonly backoffMs: readonly number[];
  private readonly sessionKey: string;

  constructor(
    private readonly transport: TransportFactory,
    options: GameClientOptions = {},
  ) {
    super();
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
    this.sessionKey = options.sessionStorageKey ?? DEFAULT_SESSION_STORAGE_KEY;

    const stored = SessionId.safeParse(safeStorage.get(this.sessionKey));

    this.sessionId = stored.success ? stored.data : undefined;
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  private connect(): void {
    clearTimeout(this.reconnectTimer);
    this.generation += 1;

    const generation = this.generation;
    const isCurrent = () => generation === this.generation;

    this.currentStatus =
      this.attempt === 0 && this.currentStatus !== "reconnecting" ? "connecting" : "reconnecting";

    this.connection = this.transport({
      onOpen: () => {
        if (isCurrent()) {
          this.initialise().catch((error: unknown) => {
            this.initialiseFailed(error);
          });
        }
      },
      onMessage: (raw) => {
        if (isCurrent()) {
          this.receive(raw);
        }
      },
      onClose: () => {
        if (isCurrent()) {
          this.handleConnectionLost();
        }
      },
    });
  }

  private async initialise(): Promise<void> {
    // An undefined `sessionId` is dropped by JSON serialisation, so the server creates a new
    // session.
    const init = await this.exchange({ type: "init", sessionId: this.sessionId }, newRequestId());

    this.sessionId = init.sessionId;
    safeStorage.set(this.sessionKey, init.sessionId);
    this.attempt = 0;
    this.currentStatus = "online";
    this.emit("debugState", init.debug.state);
    this.emit("ready", init);
  }

  /**
   * A lost connection has already scheduled a retry. A server error means the server refused to
   * start the session, and retrying would not change that. Anything else is a bug.
   */
  private initialiseFailed(error: unknown): void {
    if (error instanceof ConnectionLostError) {
      return;
    }

    if (!(error instanceof ServerError)) {
      logUnexpectedError(error);

      return;
    }

    this.dropConnection();
    this.rejectPending();
    this.currentStatus = "failed";
    this.emit("initFailed", error);
  }

  /** Sends a request on the current connection, whatever the status (`init` goes before online). */
  private async exchange<M extends OutgoingRequest>(
    message: M,
    requestId: RequestId,
  ): Promise<ResponseOf<M["type"]>> {
    const response = await this.sendRequest(message, requestId);

    if (!isResponseTo<M["type"]>(message.type, response)) {
      throw new Error(`Unexpected response "${response.type}" to "${message.type}"`);
    }

    return response;
  }

  private sendRequest(message: OutgoingMessage, requestId: RequestId): Promise<ServerMessage> {
    const connection = this.connection;

    if (!connection) {
      return Promise.reject(new ConnectionLostError("Not connected"));
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new ConnectionLostError("Request timed out"));
        // A response that never arrives means the connection is dead (ADR 010).
        this.dropConnection();
        this.handleConnectionLost();
      }, this.requestTimeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
      connection.send(encodeMessage({ ...message, requestId }));
    });
  }

  private receive(raw: string): void {
    const decoded = decodeMessage(ServerMessage, raw);

    if (!decoded.ok) {
      console.warn("Ignoring invalid server message:", decoded.error);

      return;
    }

    const message = decoded.value;

    if (message.type === "balance") {
      this.emit("balance", message.balance);

      return;
    }

    // Answers to debug commands, and pushes after a spin used up a one-shot override.
    if (message.type === "debug.state") {
      this.emit("debugState", message.state);
    }

    if (message.type === "sessionReplaced") {
      this.dropConnection();
      this.rejectPending();
      this.currentStatus = "replaced";
      this.emit("sessionReplaced", undefined);

      return;
    }

    const requestId = message.requestId;
    const pending = requestId === undefined ? undefined : this.pending.get(requestId);

    if (requestId === undefined || !pending) {
      return;
    }

    this.pending.delete(requestId);
    clearTimeout(pending.timer);

    if (message.type === "error") {
      pending.reject(new ServerError(message.code, message.message));

      return;
    }

    pending.resolve(message);
  }

  private handleConnectionLost(): void {
    if (this.currentStatus === "replaced") {
      return;
    }

    this.dropConnection();
    this.rejectPending();

    const wasOnline = this.currentStatus === "online";

    this.currentStatus = "reconnecting";

    if (wasOnline) {
      this.emit("disconnected", undefined);
    }

    const delay = Math.min(
      this.backoffMs[Math.min(this.attempt, this.backoffMs.length - 1)] ?? MAX_BACKOFF_MS,
      MAX_BACKOFF_MS,
    );

    this.attempt += 1;
    clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /** Closes the current connection and makes sure none of its events are processed. */
  private dropConnection(): void {
    this.generation += 1;

    const connection = this.connection;

    this.connection = undefined;
    connection?.close();
  }

  private rejectPending(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new ConnectionLostError());
    }

    this.pending.clear();
  }

  start(): void {
    if (this.currentStatus === "idle") {
      this.connect();
    }
  }

  /**
   * Sends a request and resolves with its response; rejects with `ServerError` or
   * `ConnectionLostError`.
   */
  request<M extends OutgoingRequest>(
    message: M,
    requestId: RequestId = newRequestId(),
  ): Promise<ResponseOf<M["type"]>> {
    if (this.currentStatus !== "online") {
      return Promise.reject(new ConnectionLostError("Not connected"));
    }

    return this.exchange(message, requestId);
  }

  /** Sends a message that has no response. */
  notify(message: Extract<OutgoingMessage, { type: "debug.dropConnection" }>): void {
    this.connection?.send(encodeMessage({ ...message, requestId: newRequestId() }));
  }

  /** Forgets the session and connects again, which creates a new session. */
  resetSession(): void {
    safeStorage.remove(this.sessionKey);
    this.sessionId = undefined;
    this.dropConnection();
    this.rejectPending();
    this.attempt = 0;
    this.connect();
  }

  /** Reconnects after the session was taken over by another tab. */
  resume(): void {
    if (this.currentStatus === "replaced") {
      this.connect();
    }
  }
}

function isResponseTo<T extends RequestType>(
  type: T,
  message: ServerMessage,
): message is ResponseOf<T> {
  return message.type === RESPONSE_TYPES[type];
}
