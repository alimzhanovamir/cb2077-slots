import { defineConfig, loadEnv } from "vite";

import rootPackage from "../../package.json";

/**
 * Modes:
 * - development / production — `ws` transport (Node.js server);
 * - `demo` — in-page emulator, no server needed;
 * - `pages` — in-page emulator, served from `/cb2077-slots/` on GitHub Pages.
 * `VITE_TRANSPORT` overrides the transport chosen by the mode. The project's version comes from the
 * root `package.json`: one version for the whole repository.
 */
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "VITE_");
  const demo = mode === "demo" || mode === "pages";
  const transport = environment.VITE_TRANSPORT || (demo ? "demo" : "ws");

  return {
    base: mode === "pages" ? "/cb2077-slots/" : "/",
    define: {
      "import.meta.env.VITE_TRANSPORT": JSON.stringify(transport),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(rootPackage.version),
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
