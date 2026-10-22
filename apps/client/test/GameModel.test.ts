import { describe, expect, it } from "vitest";

import type { RequestId } from "@cb2077/shared";

import { GameModel } from "../src/logic/GameModel.ts";
import { cents, initData, OUTCOME, round } from "./fixtures.ts";

/** Test request id: the format is not checked by the model. */
function id(value: string): RequestId {
  return value as RequestId;
}

function readyModel(overrides: Parameters<typeof initData>[0] = {}) {
  const model = new GameModel();

  model.applyInit(initData(overrides));

  return model;
}

describe("GameModel: init", () => {
  it("starts idle and online with the init state", () => {
    const model = readyModel({ bet: cents(300) });

    expect(model.snapshot()).toMatchObject({
      connection: "online",
      phase: "idle",
      balance: 100_000,
      bet: 300,
      step: 100,
      canSpin: true,
    });
  });

  it("uses the preferred step when it is valid", () => {
    const model = new GameModel({ preferredStep: 2000 });

    model.applyInit(initData());
    expect(model.snapshot().step).toBe(2000);
  });

  it("reports a session reset when the server starts a new one on reconnect", () => {
    const model = readyModel();

    model.connectionLost();
    model.applyInit(initData({ resumed: false }));
    expect(model.snapshot().message).toEqual({ code: "sessionReset" });
  });

  it("blocks spins and bets after a failed start until an init succeeds", () => {
    const model = readyModel();

    model.startFailed();

    expect(model.snapshot()).toMatchObject({
      startFailed: true,
      canSpin: false,
      canChangeBet: false,
    });

    expect(model.startSpin(id("q1"))).toBeNull();

    model.applyInit(initData({ resumed: true }));
    expect(model.snapshot()).toMatchObject({ startFailed: false, canSpin: true });
  });
});

describe("GameModel: spin", () => {
  it("goes idle → spinning → presenting → idle for a losing round", () => {
    const model = readyModel();

    expect(model.startSpin(id("q1"))).toBe(100);

    expect(model.snapshot()).toMatchObject({
      phase: "spinning",
      balance: 99_900,
      canSpin: false,
      canChangeBet: false,
    });

    model.roundReceived(round("q1"));
    expect(model.snapshot()).toMatchObject({ phase: "presenting", balance: 99_900 });
    expect(model.round?.outcome).toBe(OUTCOME);

    model.presentationDone();
    expect(model.snapshot()).toMatchObject({ phase: "idle", balance: 99_900, lastWin: 0 });
  });

  it("pays the win only after the game presented the round", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.roundReceived(round("q1", { totalWin: cents(60), balance: cents(99_960) }));

    expect(model.snapshot()).toMatchObject({ phase: "presenting", balance: 99_900, lastWin: 0 });
    model.presentationDone();
    expect(model.snapshot()).toMatchObject({ phase: "idle", balance: 99_960, lastWin: 60 });
  });

  it("ignores a round for another request", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.roundReceived(round("other"));
    expect(model.phase).toBe("spinning");
  });

  it("lets the game stop the reels and restores the balance on error", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.spinFailed("INTERNAL");

    expect(model.snapshot()).toMatchObject({
      phase: "presenting",
      balance: 100_000,
      message: { code: "spinError", error: "INTERNAL" },
    });

    expect(model.round).toBeNull();
    model.presentationDone();
    expect(model.phase).toBe("idle");
  });

  it("keeps the round's money when the game fails to present it", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.roundReceived(round("q1", { totalWin: cents(60), balance: cents(99_960) }));
    model.presentationFailed();
    model.presentationDone();

    expect(model.snapshot()).toMatchObject({
      phase: "idle",
      balance: 99_960,
      message: { code: "presentationFailed" },
    });
  });

  it("cannot spin when the bet exceeds the balance", () => {
    const model = readyModel({ balance: cents(80) });

    expect(model.snapshot()).toMatchObject({ canSpin: false, insufficientFunds: true });
    expect(model.startSpin(id("q1"))).toBeNull();
  });

  it("applies a pushed balance after the current round", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.balancePushed(cents(500));
    expect(model.snapshot().balance).toBe(99_900);

    model.roundReceived(round("q1"));
    model.presentationDone();
    expect(model.snapshot().balance).toBe(500);
  });
});

describe("GameModel: lost response recovery", () => {
  it("presents the round when lastRound matches the pending spin", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.connectionLost();

    const resolution = model.applyInit(
      initData({ resumed: true, balance: cents(99_900), lastRound: round("q1") }),
    );

    expect(resolution).toBe("round");

    expect(model.snapshot()).toMatchObject({ phase: "presenting", connection: "online" });
  });

  it("reports the spin as not played when lastRound is different", () => {
    const model = readyModel();

    model.startSpin(id("q2"));
    model.connectionLost();

    const resolution = model.applyInit(initData({ resumed: true, lastRound: round("q1") }));

    expect(resolution).toBe("notPlayed");

    expect(model.snapshot()).toMatchObject({
      phase: "presenting",
      balance: 100_000,
      message: { code: "spinNotPlayed" },
    });

    expect(model.round).toBeNull();
  });
});

describe("GameModel: bet", () => {
  it("changes the bet by the step and cycles the step", () => {
    const model = readyModel();

    model.increaseBet();
    expect(model.snapshot().bet).toBe(200);
    model.selectNextStep();
    expect(model.currentStep).toBe(200);
    model.decreaseBet();
    model.decreaseBet();
    expect(model.snapshot().bet).toBe(50);
  });

  it("does not change the bet during a spin", () => {
    const model = readyModel();

    model.startSpin(id("q1"));
    model.increaseBet();
    expect(model.snapshot().bet).toBe(100);
  });
});
