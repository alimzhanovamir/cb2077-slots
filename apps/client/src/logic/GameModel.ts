import {
  asCents,
  type Cents,
  type Currency,
  type ErrorCode,
  type PlatformConfig,
  type RequestId,
  type Round,
} from "@cb2077/shared";

import { Emitter } from "../util/Emitter.ts";
import { nextStep, sanitizeBet, sanitizeStep, stepBet } from "./betRules.ts";
import { type SpinPhase, SpinStateMachine } from "./SpinStateMachine.ts";

export type ConnectionState = "connecting" | "online" | "reconnecting" | "replaced";

/** What to tell the player. The view maps codes to text. */
export type GameMessage =
  | { code: "spinError"; error: ErrorCode }
  | { code: "spinNotPlayed" }
  /** The server started a new session instead of resuming ours (expired, restarted or reset). */
  | { code: "sessionReset" }
  | { code: "presentationFailed" };

export type GameSnapshot = {
  connection: ConnectionState;
  phase: SpinPhase;
  /** Balance shown to the player (the bet is deducted while a spin is in flight). */
  balance: Cents;
  bet: Cents;
  step: Cents;
  /** Win of the last presented round; reset when a spin starts. */
  lastWin: Cents;
  message: GameMessage | null;
  /** The game could not be started; only a reload helps. */
  startFailed: boolean;
  canSpin: boolean;
  canChangeBet: boolean;
  insufficientFunds: boolean;
};

/** The platform's part of `init`. The game's part (`init.game`) never reaches the model. */
export type InitData = {
  resumed: boolean;
  balance: Cents;
  bet: Cents;
  config: PlatformConfig;
  lastRound?: Round | undefined;
};

/** How a spin that was in flight during a reconnect ended. */
export type PendingSpinResolution = "round" | "notPlayed" | "none";

export type GameModelEvents = {
  changed: GameSnapshot;
};

/** Shown until the first `init` brings the session's currency. */
const NO_CURRENCY: Currency = { symbol: "", decimals: 2 };

/**
 * The platform's state of the game: connection, spin phases, balance and bet. It works with the
 * round's envelope only (bet, win, balance); the game's data inside it is never read here
 * (ADR 014). Knows nothing about rendering or networking — it receives commands and emits a
 * snapshot on every change.
 */
export class GameModel extends Emitter<GameModelEvents> {
  private readonly machine = new SpinStateMachine();

  private connection: ConnectionState = "connecting";
  private failedToStart = false;
  private config: PlatformConfig | null = null;
  /** Last balance confirmed by the server. */
  private serverBalance = asCents(0);

  private shownBalance = asCents(0);
  private bet = asCents(0);
  private step = asCents(0);
  private preferredStep: number | undefined;
  private lastWin = asCents(0);
  private message: GameMessage | null = null;

  private pendingRequestId: RequestId | null = null;
  private currentRound: Round | null = null;
  /** Balance pushed by the server while a spin was in flight; applied after the round. */
  private deferredBalance: Cents | null = null;

  constructor(options: { preferredStep?: number } = {}) {
    super();
    this.preferredStep = options.preferredStep;
  }

  get phase(): SpinPhase {
    return this.machine.phase;
  }

  get currentStep(): Cents {
    return this.step;
  }

  /** The round being presented, if any; `null` while the game stops after a failed spin. */
  get round(): Round | null {
    return this.currentRound;
  }

  get currency(): Currency {
    return this.config?.currency ?? NO_CURRENCY;
  }

  private changeBet(direction: 1 | -1): void {
    if (!this.config || !this.snapshot().canChangeBet) {
      return;
    }

    this.bet = stepBet(this.bet, this.step, direction, this.config);
    this.message = null;
    this.changed();
  }

  // ---------------------------------------------------------------------------
  private failSpin(message: GameMessage): void {
    this.machine.transition("presenting");
    this.pendingRequestId = null;
    this.currentRound = null;
    this.shownBalance = this.serverBalance;
    this.message = message;
  }

  private finishSpin(): void {
    this.machine.transition("idle");

    const round = this.currentRound;

    this.currentRound = null;

    if (round) {
      this.serverBalance = round.balance;
      this.lastWin = round.totalWin;
    }

    if (this.deferredBalance !== null) {
      this.serverBalance = this.deferredBalance;
      this.deferredBalance = null;
    }

    this.shownBalance = this.serverBalance;
    this.changed();
  }

  private changed(): void {
    this.emit("changed", this.snapshot());
  }

  snapshot(): GameSnapshot {
    const idle = this.phase === "idle";
    const ready = this.connection === "online" && this.config !== null && !this.failedToStart;
    const insufficientFunds = ready && this.bet > this.serverBalance;

    return {
      connection: this.connection,
      phase: this.phase,
      balance: this.shownBalance,
      bet: this.bet,
      step: this.step,
      lastWin: this.lastWin,
      message: this.message,
      startFailed: this.failedToStart,
      canSpin: ready && idle && !insufficientFunds,
      canChangeBet: ready && idle,
      insufficientFunds,
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------
  /**
   * A session is ready. Restores state and, if a spin was in flight when the connection was
   * lost, tells whether that spin was played (`lastRound` matches) or never reached the server.
   */
  applyInit(init: InitData): PendingSpinResolution {
    const isReconnect = this.config !== null;

    this.config = init.config;
    this.connection = "online";
    this.failedToStart = false;
    this.serverBalance = init.balance;

    if (!isReconnect) {
      this.bet = sanitizeBet(init.bet, init.config.defaultBet, init.config);
      this.step = sanitizeStep(this.preferredStep, init.config);
    }

    this.message = isReconnect && !init.resumed ? { code: "sessionReset" } : null;

    let resolution: PendingSpinResolution = "none";

    if (this.pendingRequestId !== null) {
      if (init.lastRound?.requestId === this.pendingRequestId) {
        this.roundReceived(init.lastRound);
        resolution = "round";
      } else {
        this.failSpin({ code: "spinNotPlayed" });
        resolution = "notPlayed";
      }
    } else if (this.phase === "idle") {
      this.shownBalance = init.balance;
    }

    this.changed();

    return resolution;
  }

  /**
   * The game could not be started: the server refused the session, or the game could not read
   * its part of `init`. Spins and bets stay disabled until a later `init` succeeds.
   */
  startFailed(): void {
    this.failedToStart = true;
    this.changed();
  }

  connectionLost(): void {
    this.connection = "reconnecting";
    this.changed();
  }

  sessionReplaced(): void {
    this.connection = "replaced";
    this.changed();
  }

  connecting(): void {
    if (this.connection === "replaced") {
      this.connection = "connecting";
    }

    this.changed();
  }

  /** The server pushed a balance (debug command). Applied now, or after the current round. */
  balancePushed(balance: Cents): void {
    if (this.phase === "idle") {
      this.serverBalance = balance;
      this.shownBalance = balance;
    } else {
      this.deferredBalance = balance;
    }

    this.changed();
  }

  // ---------------------------------------------------------------------------
  // Bet
  // ---------------------------------------------------------------------------
  increaseBet(): void {
    this.changeBet(1);
  }

  decreaseBet(): void {
    this.changeBet(-1);
  }

  /** Switches to the next step size, cycling. */
  selectNextStep(): void {
    if (!this.config || !this.snapshot().canChangeBet) {
      return;
    }

    this.step = nextStep(this.step, this.config.stepSizes);
    this.changed();
  }

  // ---------------------------------------------------------------------------
  // Spin
  // ---------------------------------------------------------------------------
  /** Starts a spin if allowed. Returns the bet to send, or `null`. */
  startSpin(requestId: RequestId): Cents | null {
    if (!this.snapshot().canSpin) {
      return null;
    }

    this.machine.transition("spinning");
    this.pendingRequestId = requestId;
    this.shownBalance = asCents(this.serverBalance - this.bet);
    this.lastWin = asCents(0);
    this.message = null;
    this.changed();

    return this.bet;
  }

  /** The server returned the round: the game presents it. */
  roundReceived(round: Round): void {
    if (this.phase !== "spinning" || round.requestId !== this.pendingRequestId) {
      return;
    }

    this.machine.transition("presenting");
    this.pendingRequestId = null;
    this.currentRound = round;
    this.changed();
  }

  /** The server rejected the spin: the game stops the reels on the previous grid. */
  spinFailed(error: ErrorCode): void {
    if (this.phase !== "spinning") {
      return;
    }

    this.failSpin({ code: "spinError", error });
    this.changed();
  }

  /**
   * The game could not present the round. The round is already played on the server, so its
   * money still counts; the player is told to reload to see it.
   */
  presentationFailed(): void {
    if (this.phase === "presenting") {
      this.message = { code: "presentationFailed" };
    }
  }

  /** The game finished presenting the round (or stopping after a failed spin). */
  presentationDone(): void {
    if (this.phase === "presenting") {
      this.finishSpin();
    }
  }
}
