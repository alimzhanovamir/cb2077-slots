export type TransportHandlers = {
  onOpen(): void;
  onMessage(raw: string): void;
  onClose(): void;
};

/** One open channel to the game server. */
export type TransportConnection = {
  send(raw: string): void;
  close(): void;
};

/**
 * Opens a new connection. Each reconnect calls the factory again, so a stale connection can
 * never deliver events into a newer one.
 */
export type TransportFactory = (handlers: TransportHandlers) => TransportConnection;
