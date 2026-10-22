import type { TransportFactory } from "./Transport.ts";

/** Transport over a real WebSocket to the Node.js server. */
export function createWebSocketTransport(url: string): TransportFactory {
  return (handlers) => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      handlers.onOpen();
    };

    socket.onmessage = (event) => {
      handlers.onMessage(String(event.data));
    };

    // `error` is always followed by `close`, so only `close` is reported.
    socket.onclose = () => {
      handlers.onClose();
    };

    return {
      send: (raw) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(raw);
        }
      },
      close: () => {
        socket.close();
      },
    };
  };
}
