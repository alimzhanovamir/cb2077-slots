interface ImportMetaEnv {
  /** `ws` (Node.js server) or `demo` (in-page emulator). */
  readonly VITE_TRANSPORT: "ws" | "demo";
  /** WebSocket URL in `ws` mode; defaults to `ws://<page host>:8080`. */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
