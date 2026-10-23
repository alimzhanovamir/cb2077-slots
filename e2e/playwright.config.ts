import { defineConfig, devices } from "@playwright/test";

/**
 * Two modes (docs/testing.md, ADR 012):
 * - `ws` (default): Node.js server + client built against it;
 * - `demo` (`E2E_MODE=demo`): client built with the in-page emulator, as on GitHub
 *   Pages.
 * Ports differ from `pnpm dev` so both can run at the same time.
 */
const mode = process.env.E2E_MODE === "demo" ? "demo" : "ws";
const SERVER_PORT = 8191;
const CLIENT_PORT = mode === "demo" ? 4192 : 4191;

const client =
  mode === "demo"
    ? `pnpm --filter @cb2077/client build:demo && pnpm --filter @cb2077/client exec vite preview --mode demo --port ${CLIENT_PORT} --strictPort`
    : `VITE_WS_URL=ws://localhost:${SERVER_PORT} pnpm --filter @cb2077/client build && pnpm --filter @cb2077/client exec vite preview --port ${CLIENT_PORT} --strictPort`;

export default defineConfig({
  testDir: "./tests",
  outputDir: `./test-results/${mode}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI runners have no GPU and render WebGL in software: one browser at a time, and twice the time
  // for slow runners (the same commit runs from 5 to 10 minutes there).
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 90_000 : 45_000,
  expect: { timeout: process.env.CI ? 20_000 : 10_000 },
  // `github` turns failures into annotations shown on the pull request.
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: `playwright-report/${mode}` }]]
    : "list",
  metadata: { mode },
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // No CSS transitions: a closing debug drawer must not intercept clicks on the canvas.
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: [
    ...(mode === "ws"
      ? [
          {
            command: "pnpm --filter @cb2077/server start",
            cwd: "..",
            env: { PORT: String(SERVER_PORT) },
            port: SERVER_PORT,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : []),
    {
      command: client,
      cwd: "..",
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    // `channel: "chromium"` runs the full Chromium in its new headless mode instead of the
    // headless shell: software WebGL then renders in the GPU process, not on the page's main
    // thread, so input and test commands are not starved on a CI runner without a GPU.
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"], channel: "chromium" } },
  ],
});
