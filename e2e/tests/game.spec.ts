import { expect, test } from "@playwright/test";

import {
  debug,
  getState,
  isDemoMode,
  openGame,
  press,
  spinWith,
  START_BALANCE,
  waitForState,
} from "../helpers/game.ts";

test.describe("slot game", () => {
  test("1. loads into idle with the starting balance", async ({ page }) => {
    const state = await openGame(page);

    expect(state).toMatchObject({
      balance: START_BALANCE,
      bet: 100,
      step: 100,
      lastWin: 0,
      message: null,
    });

    expect(state.grid).toHaveLength(5);
  });

  test("2. spins with presets and updates the balance", async ({ page }) => {
    await openGame(page);

    const afterLoss = await spinWith(page, "noWin");

    expect(afterLoss).toMatchObject({ balance: START_BALANCE - 100, lastWin: 0 });

    const afterWin = await spinWith(page, "bigWin");

    expect(afterWin).toMatchObject({ balance: START_BALANCE - 200 + 12_000, lastWin: 12_000 });
  });

  test("3. changes the bet by the selected step within limits", async ({ page }) => {
    await openGame(page);

    await press(page, "step"); // €$ 1 → €$ 2
    await press(page, "betUp");
    expect(await getState(page)).toMatchObject({ step: 200, bet: 300 });

    await press(page, "betDown");
    await press(page, "betDown");
    expect((await getState(page)).bet).toBe(50); // clamped to the minimum

    for (let count = 0; count < 4; count++) {
      await press(page, "step");
    } // → €$ 50

    for (let count = 0; count < 11; count++) {
      await press(page, "betUp");
    }

    expect(await getState(page)).toMatchObject({ step: 5000, bet: 50_000 }); // clamped to the maximum

    await debug(page, "debug-balance-apply", "10");

    const state = await waitForState(page, { balance: 1000 });

    expect(state.message).toBe("insufficientFunds");
    await press(page, "spin");
    expect((await getState(page)).phase).toBe("idle");
  });

  test("4. recovers the round after the connection drops during a spin", async ({ page }) => {
    await openGame(page);
    await debug(page, "debug-preset-noWin");
    await debug(page, "debug-latency-3000");

    await press(page, "spin");
    await waitForState(page, { phase: "spinning" });
    await debug(page, "debug-drop");

    const state = await waitForState(page, { connection: "online", phase: "idle" });

    expect(state).toMatchObject({ balance: START_BALANCE - 100, message: null });

    await debug(page, "debug-latency-0");
  });

  test("5. keeps balance and grid after a reload", async ({ page }) => {
    await openGame(page);

    const before = await spinWith(page, "smallWin");

    await page.reload();

    const after = await waitForState(page, { connection: "online", phase: "idle" });

    expect(after.balance).toBe(before.balance);
    expect(after.grid).toEqual(before.grid);
  });

  test("6. a second tab takes over the session", async ({ page, context }) => {
    test.skip(isDemoMode(), "Tab takeover is not emulated in demo mode");
    await openGame(page);

    const second = await context.newPage();

    await openGame(second);
    await waitForState(page, { connection: "replaced" });

    await page.getByTestId("system-action").click(); // the platform's HTML window
    await waitForState(page, { connection: "online" });
    await waitForState(second, { connection: "replaced" });
  });

  test("7. a notice closes with its × and by itself after 5s", async ({ page }) => {
    await openGame(page);

    const notice = page.getByTestId("system-notice"); // the platform's HTML notice

    await debug(page, "debug-fail-INVALID_BET");
    await press(page, "spin");
    await expect(notice).toContainText("Invalid bet");
    await page.getByTestId("system-notice-close").click();
    await expect(notice).toBeHidden();
    await waitForState(page, { phase: "idle" }); // the reels stop after the failed spin

    await debug(page, "debug-fail-INTERNAL");
    await press(page, "spin");
    await expect(notice).toContainText("Server error");
    await expect(notice).toBeHidden({ timeout: 8000 });
  });

  test("8. Space spins after the debug drawer was used", async ({ page }) => {
    await openGame(page);
    await debug(page, "debug-preset-noWin"); // clicks drawer buttons, which must not keep the focus

    await page.keyboard.press("Space");
    await waitForState(page, { phase: "spinning" });

    const state = await waitForState(page, { phase: "idle" });

    expect(state.balance).toBe(START_BALANCE - 100);
  });
});
