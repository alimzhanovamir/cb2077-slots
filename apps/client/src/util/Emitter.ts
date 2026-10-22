type Listener<T> = (payload: T) => void;

/** Minimal typed event emitter shared by all client layers. */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      // `on` stores every listener under its own event, so it accepts this event's payload.
      (listener as Listener<Events[K]>)(payload);
    }
  }

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);

    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    set.add(listener);

    return () => set.delete(listener);
  }
}
