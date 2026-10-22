import { expect, type Page, test } from "@playwright/test";

/** Mirrors `SlotTestHook` in apps/client/src/app/testHook.ts. */
export type SlotState = {
  phase: "idle" | "spinning" | "presenting";
  connection: "connecting" | "online" | "reconnecting" | "replaced";
  balance: number;
  bet: number;
  step: number;
  lastWin: number;
  message: string | null;
  grid: string[][] | null;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

declare global {
  interface Window {
    __slot?: { getState(): SlotState; getBounds(id: string): Bounds | null };
  }
}

export const START_BALANCE = 100_000;

export function isDemoMode(): boolean {
  return process.env.E2E_MODE === "demo";
}

export function getState(page: Page): Promise<SlotState> {
  return page.evaluate(() => {
    if (!window.__slot) {
      throw new Error("The test hook is not installed");
    }

    return window.__slot.getState();
  });
}

/** Waits until the state matches every given field. */
export async function waitForState(
  page: Page,
  expected: Partial<SlotState>,
  timeout = 20_000,
): Promise<SlotState> {
  await page.waitForFunction(
    (fields) => {
      const state = window.__slot?.getState();

      if (!state) {
        return false;
      }

      // `Object.entries` widens keys to `string`; `fields` is a `Partial<SlotState>`.
      return Object.entries(fields).every(
        ([key, value]) =>
          JSON.stringify(state[key as keyof typeof state]) === JSON.stringify(value),
      );
    },
    expected,
    { timeout },
  );

  return getState(page);
}

export async function openGame(page: Page): Promise<SlotState> {
  await page.goto("/");

  return waitForState(page, { connection: "online", phase: "idle" });
}

/** Clicks (or taps on touch devices) a game control on the canvas at its on-screen position. */
export async function press(page: Page, id: string): Promise<void> {
  const bounds = await page.evaluate((control) => window.__slot?.getBounds(control) ?? null, id);

  if (!bounds) {
    throw new Error(`Control "${id}" is not visible`);
  }

  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;

  if (test.info().project.use.hasTouch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
}

/**
 * Runs an action in the debug drawer and waits until it was applied: the server answered, or the
 * connection dropped / a new session started. The status text fades out; `data-state` stays.
 */
export async function debug(page: Page, testId: string, fill?: string): Promise<void> {
  const drawer = page.getByTestId("debug-drawer");

  if (!(await drawer.evaluate((element) => element.classList.contains("open")))) {
    await page.getByTestId("debug-toggle").click();
  }

  if (fill !== undefined) {
    await page.getByTestId("debug-balance-input").fill(fill);
  }

  await page.getByTestId(testId).click();
  await expect(page.getByTestId("debug-status")).toHaveAttribute("data-state", "applied");

  await page.getByTestId("debug-toggle").click();
  await expect(drawer).not.toHaveClass(/open/);
}

/** Selects a preset for the next spin, spins and waits until the round is fully presented. */
export async function spinWith(
  page: Page,
  preset: "noWin" | "smallWin" | "bigWin" | "maxWin",
): Promise<SlotState> {
  await debug(page, `debug-preset-${preset}`);
  await press(page, "spin");
  await waitForState(page, { phase: "spinning" });

  return waitForState(page, { phase: "idle" });
}
