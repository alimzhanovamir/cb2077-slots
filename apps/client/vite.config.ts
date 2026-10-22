import { defineConfig, loadEnv } from "vite";

/**
 * Modes:
 * - development / production — `ws` transport (Node.js server);
 * - `demo` — in-page emulator, no server needed;
 * - `pages` — in-page emulator, served from `/cb2077-slots/` on GitHub Pages.
 * `VITE_TRANSPORT` overrides the transport chosen by the mode.
 */
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "VITE_");
  const demo = mode === "demo" || mode === "pages";
  const transport = environment.VITE_TRANSPORT || (demo ? "demo" : "ws");

  return {
    base: mode === "pages" ? "/cb2077-slots/" : "/",
    define: {
      "import.meta.env.VITE_TRANSPORT": JSON.stringify(transport),
    },
    server: {
      host: true, // reachable from a phone on the same network
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
    build: {
      outDir: demo ? `dist-${mode}` : "dist",
      chunkSizeWarningLimit: 1000,
    },
  };
});
