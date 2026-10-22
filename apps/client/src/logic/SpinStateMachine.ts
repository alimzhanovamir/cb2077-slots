/**
 * Phases of one spin. The connection state is tracked separately (see `GameModel`), because a
 * connection can drop in any phase. How a round is shown is the game's business: for the platform
 * it is one `presenting` phase.
 */
export type SpinPhase = "idle" | "spinning" | "presenting";

const TRANSITIONS: Record<SpinPhase, readonly SpinPhase[]> = {
  idle: ["spinning"],
  // A round arrived and the game presents it, or the spin failed and the game stops the reels.
  spinning: ["presenting"],
  presenting: ["idle"],
};

export class SpinStateMachine {
  private current: SpinPhase = "idle";

  get phase(): SpinPhase {
    return this.current;
  }

  canTransition(to: SpinPhase): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  transition(to: SpinPhase): void {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid spin transition ${this.current} → ${to}`);
    }

    this.current = to;
  }
}
