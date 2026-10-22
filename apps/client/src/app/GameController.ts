import type { InitResponse } from "@cb2077/shared";

import type { GameMessage, GameModel, GameSnapshot } from "../logic/GameModel.ts";
import { ConnectionLostError, type GameClient, ServerError } from "../net/GameClient.ts";
import { newRequestId } from "../net/ids.ts";
import { logUnexpectedError } from "../util/errors.ts";
import { safeStorage } from "../util/storage.ts";
import { wait } from "../util/wait.ts";
import type { Game, HudState } from "../view/Game.ts";
import type { NoticeContent, OverlayContent, SystemLayer } from "../view/SystemLayer.ts";
import { texts } from "../view/texts.ts";

const STEP_STORAGE_KEY = "cb2077.betStep";

/**
 * The reels spin at least this long, even if the round arrives earlier. A platform rule, not an
 * animation: jurisdictions set their own minimum (roadmap).
 */
const MIN_SPIN_MS = 1000;

/**
 * The only place that knows the model, the game, the system layer and the network. It drives the
 * round's lifecycle; how a round looks is the game's business (ADR 014).
 */
export class GameController {
  private presenting = false;
  private paused = false;

  constructor(
    private readonly model: GameModel,
    private readonly game: Game,
    private readonly client: GameClient,
    private readonly systemLayer: SystemLayer,
  ) {
    model.on("changed", (snapshot) => {
      this.render(snapshot);
    });

    game.setActions({
      spinPressed: () => {
        this.requestSpin();
      },
      betUp: () => {
        model.increaseBet();
      },
      betDown: () => {
        model.decreaseBet();
      },
      stepPressed: () => {
        model.selectNextStep();
        safeStorage.set(STEP_STORAGE_KEY, String(model.currentStep));
      },
    });

    systemLayer.onAction(() => {
      model.connecting();
      client.resume();
    });

    client.on("ready", (init) => {
      this.onReady(init);
    });

    client.on("disconnected", () => {
      model.connectionLost();
    });

    client.on("sessionReplaced", () => {
      model.sessionReplaced();
    });

    client.on("initFailed", (error) => {
      logUnexpectedError(error);
      model.startFailed();
    });

    client.on("balance", (balance) => {
      model.balancePushed(balance);
    });
  }

  private onReady(init: InitResponse): void {
    const phaseBefore = this.model.phase;
    const resolution = this.model.applyInit(init);

    if (phaseBefore === "idle") {
      this.showGame(init.game);
    }

    // A spin was in flight when the connection dropped: finish it now.
    if (resolution !== "none") {
      this.present().catch(logUnexpectedError);
    }
  }

  /** Hands `init.game` to the game, unread. If the game cannot read it, the game cannot start. */
  private showGame(game: unknown): void {
    try {
      this.game.show(game);
    } catch (error) {
      logUnexpectedError(error);
      this.model.startFailed();
    }
  }

  private async spin(): Promise<void> {
    const requestId = newRequestId();
    const bet = this.model.startSpin(requestId);

    if (bet === null) {
      return;
    }

    this.game.startSpin();

    const minSpin = wait(MIN_SPIN_MS);

    try {
      const response = await this.client.request({ type: "spin", bet }, requestId);

      await minSpin;
      this.model.roundReceived(response.round);
    } catch (error) {
      if (error instanceof ServerError) {
        await minSpin;
        this.model.spinFailed(error.code);
      } else if (!(error instanceof ConnectionLostError)) {
        throw error;
      }
      // ConnectionLostError: the reels keep spinning; `onReady` resolves the spin after
      // reconnecting.
    }

    await this.present();
  }

  /**
   * Hands the round to the game and waits until it is shown, or lets the game stop the reels
   * after a failed spin. The round's outcome is passed on unread.
   */
  private async present(): Promise<void> {
    if (this.presenting || this.model.phase !== "presenting") {
      return;
    }

    this.presenting = true;

    try {
      const round = this.model.round;

      if (round) {
        await this.game.presentRound(round.outcome, { totalWin: round.totalWin });
      } else {
        await this.game.abortSpin();
      }
    } catch (error) {
      // The game rejected the round (e.g. data it does not understand). The round is played on
      // the server either way, so its money counts; the player is asked to reload.
      logUnexpectedError(error);
      this.model.presentationFailed();
      await this.game.abortSpin().catch(logUnexpectedError);
    } finally {
      this.presenting = false;
    }

    this.model.presentationDone();
  }

  /** Starts a spin without waiting for it; unexpected errors are logged. */
  private requestSpin(): void {
    this.spin().catch(logUnexpectedError);
  }

  private render(snapshot: GameSnapshot): void {
    const overlay = overlayFor(snapshot);

    this.game.update(toHudState(snapshot));
    this.systemLayer.showOverlay(overlay);
    this.systemLayer.showNotice(noticeFor(snapshot));

    // The game stays frozen under a system window.
    if (overlay && !this.paused) {
      this.paused = true;
      this.game.pause();
    } else if (!overlay && this.paused) {
      this.paused = false;
      this.game.resume();
    }
  }

  static preferredStep(): number | undefined {
    const stored = Number(safeStorage.get(STEP_STORAGE_KEY));

    return Number.isFinite(stored) && stored > 0 ? stored : undefined;
  }

  start(): void {
    this.render(this.model.snapshot());
    this.client.start();
  }
}

function toHudState(snapshot: GameSnapshot): HudState {
  return {
    balance: snapshot.balance,
    bet: snapshot.bet,
    step: snapshot.step,
    win: snapshot.lastWin,
    spinEnabled: snapshot.canSpin,
    betEnabled: snapshot.canChangeBet,
  };
}

function noticeFor(snapshot: GameSnapshot): NoticeContent | null {
  if (snapshot.message) {
    return describe(snapshot.message);
  }

  if (snapshot.insufficientFunds && snapshot.phase === "idle") {
    return { text: texts.insufficientFunds, kind: "error" };
  }

  return null;
}

function describe(message: GameMessage): NoticeContent {
  switch (message.code) {
    case "spinError":
      return { text: texts.spinErrors[message.error], kind: "error" };
    case "spinNotPlayed":
      return { text: texts.spinNotPlayed, kind: "error" };
    case "sessionReset":
      return { text: texts.sessionReset, kind: "info" };
    case "presentationFailed":
      return { text: texts.presentationFailed, kind: "error" };
  }
}

function overlayFor(snapshot: GameSnapshot): OverlayContent | null {
  if (snapshot.startFailed) {
    return { label: texts.labels.error, text: texts.startFailed };
  }

  switch (snapshot.connection) {
    case "connecting":
      return { label: texts.labels.connection, text: texts.connecting, busy: true };
    case "reconnecting":
      return { label: texts.labels.connection, text: texts.reconnecting, busy: true };
    case "replaced":
      return { label: texts.labels.session, text: texts.sessionReplaced, action: texts.playHere };
    case "online":
      return null;
  }
}
