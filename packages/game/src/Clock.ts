type Timer = { remaining: number; resolve: () => void };

/**
 * The game's own time. It advances only with the ticker, so `pause()`, which stops the ticker,
 * freezes every delay together with the animation.
 */
export class Clock {
  private readonly timers = new Set<Timer>();

  /** Advances the time; called on every tick. */
  update(deltaMs: number): void {
    for (const timer of [...this.timers]) {
      timer.remaining -= deltaMs;

      if (timer.remaining <= 0) {
        this.timers.delete(timer);
        timer.resolve();
      }
    }
  }

  /** Resolves after `milliseconds` of game time. */
  wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.add({ remaining: milliseconds, resolve });
    });
  }
}
