import { asCents, type DebugState, ERROR_CODES, type PresetInfo } from "@cb2077/shared";

import type { GameClient } from "../net/GameClient.ts";
import { logUnexpectedError } from "../util/errors.ts";
import { releaseFocusAfterPointerClick } from "../util/focus.ts";
import { Terminal, type TerminalSegment } from "./Terminal.ts";

/** Like the other rows: the overrides first, the reset (None) last. */
const LATENCY_PRESETS_MS = [3000, 6000, 0] as const;
const MILLISECONDS_PER_SECOND = 1000;
/** Commands without a response are confirmed by a client event; this is how long to wait. */
const CONFIRM_TIMEOUT_MS = 10_000;

/**
 * Developer drawer (ADR 011): plain DOM, talks to the server only through the game client.
 * Every control has a `data-testid` for E2E tests.
 */
export class DebugDrawer {
  private readonly root = document.createElement("aside");
  private readonly presetsBox = document.createElement("div");
  private readonly readout = document.createElement("dl");
  private readonly terminal = new Terminal();
  private presets: PresetInfo[] = [];
  private state: DebugState = { latencyMs: 0 };

  constructor(
    host: HTMLElement,
    private readonly client: GameClient,
  ) {
    this.root.className = "debug-drawer";
    this.root.dataset.testid = "debug-drawer";

    const toggle = this.button("Debug", "debug-toggle", () => this.root.classList.toggle("open"));

    toggle.className = "debug-toggle";

    const panel = document.createElement("div");

    panel.className = "debug-panel";

    panel.append(
      this.header(),
      section("Next outcome", this.presetsBox),
      section("Next error", this.errorButtons()),
      section("Latency (spin response)", this.latencyControls()),
      section(
        "Connection",
        this.button(
          "Drop connection",
          "debug-drop",
          () => {
            const dropped =
              this.client.status === "online"
                ? this.nextEvent("disconnected")
                : Promise.reject(new Error("Not connected"));

            this.run(action("drop", "CONNECTION"), dropped);
            this.client.notify({ type: "debug.dropConnection" });
          },
          "danger",
        ),
      ),
      section("Balance", this.balanceControls()),
      section(
        "Session",
        this.button("Reset session", "debug-reset-session", () => {
          this.run(action("reset", "SESSION"), this.nextEvent("ready"));
          this.client.resetSession();
        }),
      ),
      this.terminal.element,
    );

    this.root.append(toggle, panel);
    host.append(this.root);

    client.on("ready", (init) => {
      this.presets = init.debug.presets;
      this.renderPresets();
      this.renderState();
    });

    client.on("debugState", (state) => {
      this.state = state;
      this.renderState();
    });

    this.renderState();
  }

  /** The title and a readout of the overrides the server confirmed. */
  private header(): HTMLElement {
    const header = document.createElement("header");
    const title = document.createElement("h2");
    const subtitle = document.createElement("small");

    header.className = "debug-header";
    title.className = "debug-title";
    title.textContent = "Debug";
    subtitle.textContent = "// session overrides";
    title.append(subtitle);
    this.readout.className = "debug-readout";
    this.readout.dataset.testid = "debug-state";
    header.append(title, this.readout);

    return header;
  }

  private renderPresets(): void {
    this.presetsBox.replaceChildren(
      ...this.presets.map((preset) =>
        this.button(preset.label, `debug-preset-${preset.id}`, () => {
          this.run(
            set("NEXT OUTCOME", preset.label.toLowerCase()),
            this.client.request({ type: "debug.forceNext", preset: preset.id }),
          );
        }),
      ),
      this.button("Random", "debug-preset-none", () => {
        this.run(
          set("NEXT OUTCOME", "random"),
          this.client.request({ type: "debug.forceNext", preset: null }),
        );
      }),
    );
  }

  private renderState(): void {
    const { forceNext, failNext, latencyMs } = this.state;
    const preset = this.presets.find((candidate) => candidate.id === forceNext);

    this.readout.replaceChildren(
      readoutRow("Next outcome", preset?.label ?? forceNext ?? "Random", forceNext ? "set" : null),
      readoutRow("Next error", failNext ?? "None", failNext ? "danger" : null),
      readoutRow("Latency", latencyLabel(latencyMs), latencyMs > 0 ? "set" : null),
    );
  }

  private errorButtons(): HTMLElement {
    const box = document.createElement("div");

    for (const code of ERROR_CODES) {
      box.append(
        this.button(
          code,
          `debug-fail-${code}`,
          () => {
            this.run(
              set("NEXT ERROR", code),
              this.client.request({ type: "debug.failNext", code }),
            );
          },
          "danger",
        ),
      );
    }

    box.append(
      this.button("None", "debug-fail-none", () => {
        this.run(
          set("NEXT ERROR", "none"),
          this.client.request({ type: "debug.failNext", code: null }),
        );
      }),
    );

    return box;
  }

  private latencyControls(): HTMLElement {
    const box = document.createElement("div");

    for (const latencyMs of LATENCY_PRESETS_MS) {
      box.append(
        this.button(latencyLabel(latencyMs), `debug-latency-${latencyMs}`, () => {
          this.run(
            set("LATENCY", latencyLabel(latencyMs).toLowerCase()),
            this.client.request({ type: "debug.setLatency", ms: latencyMs }),
          );
        }),
      );
    }

    const hint = document.createElement("small");

    hint.textContent = "Above 5s the client times out and reconnects.";
    box.append(hint);

    return box;
  }

  private balanceControls(): HTMLElement {
    const box = document.createElement("div");
    const input = document.createElement("input");

    input.type = "number";
    input.min = "0";
    input.step = "0.5";
    input.placeholder = "€$";
    input.dataset.testid = "debug-balance-input";

    box.append(
      this.button("Reset balance", "debug-reset-balance", () => {
        this.run(action("reset", "BALANCE"), this.client.request({ type: "debug.resetBalance" }));
      }),
      input,
      this.button("Set", "debug-balance-apply", () => {
        const cents = Math.round(Number(input.value) * 100);
        const command = set("BALANCE", input.value);

        if (!Number.isSafeInteger(cents) || cents < 0) {
          this.run(command, Promise.reject(new Error("Enter a non-negative amount")));

          return;
        }

        this.run(
          command,
          this.client.request({ type: "debug.setBalance", balance: asCents(cents) }),
        );
      }),
    );

    return box;
  }

  /** Shows the command in the terminal until `result` settles, then whether it was applied. */
  private run(command: readonly TerminalSegment[], result: Promise<unknown>): void {
    this.terminal.execute(command, result).catch(logUnexpectedError);
  }

  /** Resolves on the client's next `event`; rejects if it does not come in time. */
  private nextEvent(event: "disconnected" | "ready"): Promise<void> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.client.on(event, () => {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      });

      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("No answer"));
      }, CONFIRM_TIMEOUT_MS);
    });
  }

  private button(
    label: string,
    testId: string,
    onClick: () => void,
    tone?: "danger",
  ): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.dataset.testid = testId;

    if (tone) {
      button.dataset.tone = tone;
    }

    button.addEventListener("click", onClick);
    releaseFocusAfterPointerClick(button);

    return button;
  }
}

/** `set KEY "value"` */
function set(key: string, value: string): TerminalSegment[] {
  return [
    { text: "set ", tone: "verb" },
    { text: `${key} `, tone: "key" },
    { text: `"${value}"`, tone: "value" },
  ];
}

/** `verb KEY` */
function action(verb: string, key: string): TerminalSegment[] {
  return [
    { text: `${verb} `, tone: "verb" },
    { text: key, tone: "key" },
  ];
}

/** `None` for no delay, otherwise the delay in seconds (`3s`). */
function latencyLabel(milliseconds: number): string {
  return milliseconds === 0 ? "None" : `${milliseconds / MILLISECONDS_PER_SECOND}s`;
}

/** One line of the header's readout; `tone` marks an override that is on. */
function readoutRow(label: string, value: string, tone: "set" | "danger" | null): HTMLElement {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  row.className = "debug-readout-row";

  if (tone) {
    row.dataset.tone = tone;
  }

  term.textContent = label;
  description.textContent = value;
  row.append(term, description);

  return row;
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const element = document.createElement("section");
  const label = document.createElement("h3");

  label.textContent = title;
  element.append(label, ...children);

  return element;
}
