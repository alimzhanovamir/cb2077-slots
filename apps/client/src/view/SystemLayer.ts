import { releaseFocusAfterPointerClick } from "../util/focus.ts";
import { texts } from "./texts.ts";

/** Content of the blocking system window. */
export type OverlayContent = {
  /** What the window is about, shown in its header. */
  label: string;
  text: string;
  /** Label of an optional action button. */
  action?: string;
  /** Shows an activity indicator: the platform is working on it (connecting). */
  busy?: boolean;
};

/** A system message that does not block the game. */
export type NoticeContent = {
  text: string;
  kind: "info" | "error";
};

/** The parts of a system panel: the same look for the window and the notice. */
type Panel = {
  root: HTMLElement;
  header: HTMLElement;
  label: HTMLElement;
  text: HTMLElement;
  /** A row of dashes: activity in the window, the time left in the notice. */
  dashes: HTMLElement;
};

/** How long a notice stays; the countdown pauses while the pointer is over it. */
const NOTICE_MS = 5000;
const DASHES = 5;
/** Opacity of a dash that is off. */
const DASH_OFF = 0.15;

/**
 * The platform's own HTML on top of the game (ADR 014), in the platform's own style, so it works
 * whatever the game renders with:
 * - a blocking window (connecting, reconnecting, opened elsewhere): it stays while its state lasts;
 * - a notice (errors, a session reset): it closes itself after 5s, or with its × button.
 */
export class SystemLayer {
  private readonly overlay = document.createElement("div");
  private readonly dialog = createPanel();
  private readonly overlayAction = document.createElement("button");
  private readonly notice = document.createElement("div");
  private readonly toast = createPanel();
  private actionHandler: (() => void) | undefined;
  /** The notice shown or dismissed last; the same notice is not shown again until it changes. */
  private noticeKey: string | null = null;
  private countdown: number | undefined;
  private noticeHovered = false;

  constructor(host: HTMLElement) {
    this.buildOverlay();
    this.buildNotice();
    host.append(this.notice, this.overlay);
  }

  private buildOverlay(): void {
    this.overlay.className = "system-overlay";
    this.overlay.dataset.testid = "system-overlay";
    this.overlay.setAttribute("role", "alertdialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.hidden = true;
    this.dialog.dashes.classList.add("system-busy");
    this.overlayAction.type = "button";
    this.overlayAction.className = "system-action";
    this.overlayAction.dataset.testid = "system-action";

    this.overlayAction.addEventListener("click", () => {
      this.actionHandler?.();
    });

    releaseFocusAfterPointerClick(this.overlayAction);
    this.dialog.root.append(this.overlayAction);
    this.overlay.append(this.dialog.root);
  }

  private buildNotice(): void {
    const close = document.createElement("button");

    this.notice.className = "system-notice";
    this.notice.dataset.testid = "system-notice";
    this.notice.setAttribute("role", "status");
    this.notice.hidden = true;
    close.type = "button";
    close.className = "system-close";
    close.dataset.testid = "system-notice-close";
    close.setAttribute("aria-label", texts.close);
    close.textContent = "×";

    close.addEventListener("click", () => {
      this.dismissNotice();
    });

    releaseFocusAfterPointerClick(close);
    this.toast.header.append(close);

    this.notice.addEventListener("pointerenter", () => {
      this.noticeHovered = true;
    });

    this.notice.addEventListener("pointerleave", () => {
      this.noticeHovered = false;
    });

    this.notice.append(this.toast.root);
  }

  /**
   * Counts the notice down on animation frames, so a hidden tab does not use up its time. The
   * dashes go out one by one, from the right.
   */
  private startCountdown(): void {
    let remaining = NOTICE_MS;
    let last = performance.now();

    const tick = (now: number) => {
      if (!this.noticeHovered) {
        remaining -= now - last;
      }

      last = now;
      this.showTimeLeft(Math.max(0, remaining / NOTICE_MS));

      if (remaining <= 0) {
        this.dismissNotice();

        return;
      }

      this.countdown = requestAnimationFrame(tick);
    };

    this.showTimeLeft(1);
    this.countdown = requestAnimationFrame(tick);
  }

  /** Lights the dashes for the share of time left; the last lit one fades as its time runs out. */
  private showTimeLeft(share: number): void {
    const lit = share * DASHES;

    [...this.toast.dashes.children].forEach((dash, index) => {
      if (dash instanceof HTMLElement) {
        const level = Math.min(1, Math.max(0, lit - index));

        dash.style.opacity = String(DASH_OFF + (1 - DASH_OFF) * level);
      }
    });
  }

  private stopCountdown(): void {
    if (this.countdown !== undefined) {
      cancelAnimationFrame(this.countdown);
      this.countdown = undefined;
    }
  }

  /** Hides the notice; it stays hidden until a different notice comes. */
  private dismissNotice(): void {
    this.stopCountdown();
    this.noticeHovered = false;
    this.notice.hidden = true;
  }

  /** Called when the player presses the window's action button. */
  onAction(handler: () => void): void {
    this.actionHandler = handler;
  }

  /** Shows the blocking window, or hides it with `null`. */
  showOverlay(content: OverlayContent | null): void {
    this.overlay.hidden = content === null;

    if (!content) {
      return;
    }

    this.dialog.label.textContent = content.label;
    this.dialog.text.textContent = content.text;
    this.dialog.dashes.hidden = content.busy !== true;
    this.overlayAction.hidden = content.action === undefined;
    this.overlayAction.textContent = content.action ?? "";
  }

  /**
   * Shows a notice, or hides it with `null`. The platform renders on every change, so the same
   * notice again keeps its countdown, or stays closed once it was closed.
   */
  showNotice(content: NoticeContent | null): void {
    const key = content ? `${content.kind}:${content.text}` : null;

    if (key === this.noticeKey) {
      return;
    }

    this.noticeKey = key;
    this.dismissNotice();

    if (!content) {
      return;
    }

    this.toast.label.textContent =
      content.kind === "error" ? texts.labels.error : texts.labels.notice;

    this.toast.text.textContent = content.text;
    this.toast.root.classList.toggle("info", content.kind === "info");
    this.notice.hidden = false;
    this.startCountdown();
  }
}

/** A system panel: a header with its label, the text and a row of dashes. */
function createPanel(): Panel {
  const root = document.createElement("div");
  const header = document.createElement("div");
  const label = document.createElement("span");
  const text = document.createElement("p");
  const dashes = document.createElement("div");

  root.className = "system-panel";
  header.className = "system-header";
  label.className = "system-label";
  text.className = "system-text";
  dashes.className = "system-dashes";
  dashes.setAttribute("aria-hidden", "true");
  dashes.append(...Array.from({ length: DASHES }, () => document.createElement("span")));
  header.append(label);
  root.append(header, text, dashes);

  return { root, header, label, text, dashes };
}
