/** One channel between a client and the RGS (a WebSocket, or in-page callbacks). */
export type Connection = {
  /** Sends one serialised message to the client. */
  send(raw: string): void;
  /** Closes the channel from the server side. */
  close(): void;
};

/** What the RGS returns for a connection: the transport feeds it incoming events. */
export type ConnectionHandler = {
  onMessage(raw: string): void;
  onClose(): void;
};
