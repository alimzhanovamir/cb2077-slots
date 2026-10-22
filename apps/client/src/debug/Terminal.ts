import { wait } from "../util/wait.ts";

/** A piece of a typed line; the tone picks its colour. */
export type TerminalSegment = {
  text: string;
  tone: "verb" | "key" | "value";
};

type Result = { ok: true } | { ok: false; reason: string };

/** Time per typed character; no typing when the user prefers reduced motion. */
const TYPE_MS = 22;
/** How long a finished command stays, then how long it fades out (`.fading` in CSS). */
const RESULT_SHOW_MS = 3000;
const RESULT_FADE_MS = 400;

/**
 * The debug drawer's command line. A command is typed in; once the server answers, a new prompt
 * follows like in a shell, with the error above it if the command failed. Its
 * `data-state` (`pending`, `applied`, `failed`) is set as soon as the result is known, without
 * waiting for the animation, so E2E tests can wait for it.
 */
export class Terminal {
  readonly element = document.createElement("div");
  private readonly screen = document.createElement("div");
  private readonly cursor = document.createElement("span");
  /** Counts commands: a newer one stops the animation of an older one. */
  private commands = 0;

  constructor() {
    const bar = document.createElement("div");
    const title = document.createElement("span");
    const link = document.createElement("span");

    this.element.className = "debug-terminal";
    this.element.dataset.testid = "debug-status";
    bar.className = "debug-terminal-bar";
    title.textContent = "Terminal";
    link.textContent = "// RGS link";
    bar.append(title, link);
    this.screen.className = "debug-terminal-screen";
    this.screen.setAttribute("role", "log");
    this.cursor.className = "debug-cursor";
    this.element.append(bar, this.screen);
    this.promptLine();
  }

  /** A new line that starts with the prompt and holds the cursor. */
  private promptLine(): HTMLElement {
    const line = document.createElement("p");
    const prompt = document.createElement("span");

    line.className = "debug-terminal-line";
    prompt.className = "debug-prompt";
    prompt.textContent = "> ";
    line.append(prompt, this.cursor);
    this.screen.append(line);

    return line;
  }

  /** A failed command's output. A command that was applied prints nothing, like in a shell. */
  private errorLine(error: string): HTMLElement {
    const line = document.createElement("p");

    line.className = "debug-terminal-line debug-terminal-error";
    line.textContent = error;
    this.screen.append(line);

    return line;
  }

  /**
   * Types the segments into `line`. The number of characters shown follows the elapsed time, not
   * a timer per character, so slow frames do not slow the typing down. Stops when `current`
   * turns false.
   */
  private async type(
    line: HTMLElement,
    segments: readonly TerminalSegment[],
    current: () => boolean,
  ): Promise<void> {
    const parts = segments.map(({ text, tone }) => {
      const span = document.createElement("span");

      span.className = `debug-tone-${tone}`;

      return { text, span };
    });

    line.append(...parts.map(({ span }) => span), this.cursor);

    const total = parts.reduce((sum, { text }) => sum + text.length, 0);
    const instant = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    for (;;) {
      const shown = instant ? total : Math.floor((performance.now() - start) / TYPE_MS);
      let left = shown;

      for (const { text, span } of parts) {
        span.textContent = text.slice(0, Math.max(0, left));
        left -= text.length;
      }

      if (shown >= total) {
        return;
      }

      await nextFrame();

      if (!current()) {
        return;
      }
    }
  }

  /** Types `command`, prints how `result` settled, and clears both a few seconds later. */
  async execute(command: readonly TerminalSegment[], result: Promise<unknown>): Promise<void> {
    this.commands += 1;

    const run = this.commands;
    const current = () => run === this.commands;

    this.element.dataset.state = "pending";

    const settled = settle(result).then((value) => {
      if (current()) {
        this.element.dataset.state = value.ok ? "applied" : "failed";
      }

      return value;
    });

    this.screen.replaceChildren();

    const commandLine = this.promptLine();

    await this.type(commandLine, command, current);

    if (!current()) {
      return;
    }

    // While the server works, the cursor waits at the end of the command.
    const value = await settled;

    if (!current()) {
      return;
    }

    const errorLine = value.ok ? null : this.errorLine(value.reason);

    this.promptLine();
    await wait(RESULT_SHOW_MS);

    if (!current()) {
      return;
    }

    for (const line of [commandLine, errorLine]) {
      line?.classList.add("fading");
    }

    await wait(RESULT_FADE_MS);

    if (current()) {
      commandLine.remove();
      errorLine?.remove();
    }
  }
}

function settle(result: Promise<unknown>): Promise<Result> {
  return result.then(
    (): Result => ({ ok: true }),
    (error: unknown): Result => ({
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    }),
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
