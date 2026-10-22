import { Application, Container, Graphics, Text } from "pixi.js";

import { GameInit, type Grid, REELS, ROWS, SpinOutcome } from "@cb2077/shared/game";

import { Clock } from "./Clock.ts";
import { loadFonts } from "./fonts.ts";
import { ReelSet } from "./reels/ReelSet.ts";
import { texts } from "./texts.ts";
import { COLORS, FONT, REEL_LAYOUT, SCENE, TIMINGS } from "./theme.ts";
import { ControlsPanel, isControlId } from "./ui/ControlsPanel.ts";

/** What the game needs from whoever runs it. */
export type GameOptions = {
  /** Element the game puts its canvas into; the game takes its size. */
  host: HTMLElement;
  /** Formats cents in the session's currency; the game formats no money itself. */
  formatMoney: (amount: number) => string;
};

/** What the player did in the game's UI. The platform decides what follows. */
export type PlayerActions = {
  spinPressed: () => void;
  betUp: () => void;
  betDown: () => void;
  stepPressed: () => void;
};

/** The bottom panel's values, in cents, and which controls are enabled. */
export type HudState = {
  balance: number;
  bet: number;
  step: number;
  win: number;
  spinEnabled: boolean;
  betEnabled: boolean;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * CB2077's presentation in PixiJS: its own canvas, the reels, the bottom panel and the whole round
 * presentation. It does not know where it runs (ADR 014): it validates the game data it receives
 * and reports player actions through the callbacks it was given.
 */
export class GameView {
  private readonly scene = new Container();
  private readonly clock = new Clock();
  private readonly reels: ReelSet;
  private readonly controls: ControlsPanel;
  private readonly winBanner: Text;
  private actions: PlayerActions | undefined;
  /** Grid the reels show now; a spin that was not played stops on it. */
  private grid: Grid | null = null;
  private spinEnabled = false;
  private paused = false;
  /** Set while a round is presented: the WIN field then shows that round's win. */
  private presenting = false;

  private constructor(
    private readonly app: Application,
    private readonly formatMoney: (amount: number) => string,
  ) {
    app.stage.addChild(this.scene);

    const background = new Graphics()
      .rect(0, 0, SCENE.width, SCENE.height)
      .fill({ color: COLORS.background });

    const title = new Text({
      text: texts.title,
      style: {
        fontFamily: FONT,
        fontSize: 40,
        fontWeight: "800",
        fill: COLORS.yellow,
        letterSpacing: 6,
      },
    });

    title.anchor.set(0.5, 0);
    title.position.set(SCENE.width / 2, 22);
    this.reels = new ReelSet(REELS, ROWS, this.clock);
    this.reels.position.set((SCENE.width - this.reels.areaWidth) / 2, REEL_LAYOUT.top);

    this.winBanner = new Text({
      text: "",
      style: {
        fontFamily: FONT,
        fontSize: 72,
        fontWeight: "800",
        fill: COLORS.yellow,
        stroke: { color: 0x000000, width: 8 },
      },
    });

    this.winBanner.anchor.set(0.5);

    this.winBanner.position.set(
      SCENE.width / 2,
      REEL_LAYOUT.top + (REEL_LAYOUT.cellHeight * ROWS) / 2,
    );

    this.winBanner.visible = false;

    this.controls = new ControlsPanel({
      spin: () => this.actions?.spinPressed(),
      betUp: () => this.actions?.betUp(),
      betDown: () => this.actions?.betDown(),
      step: () => this.actions?.stepPressed(),
    });

    this.scene.addChild(background, title, this.reels, this.winBanner, this.controls);

    app.ticker.add((ticker) => {
      this.clock.update(ticker.deltaMS);
      this.reels.update(ticker.deltaMS);
    });

    // `resizeTo` resizes the renderer with the host (also on rotation); re-fit the scene then.
    app.renderer.on("resize", () => {
      this.fit();
    });

    window.addEventListener("keydown", (event) => {
      this.onKey(event);
    });

    this.fit();
  }

  /** Scales the 1280×720 scene to fit the host, keeping its aspect ratio (letterboxing). */
  private fit(): void {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / SCENE.width, height / SCENE.height);

    this.scene.scale.set(scale);
    this.scene.position.set((width - SCENE.width * scale) / 2, (height - SCENE.height * scale) / 2);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.repeat || this.paused) {
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLElement &&
      ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)
    ) {
      return;
    }

    event.preventDefault();

    if (this.spinEnabled) {
      this.actions?.spinPressed();
    }
  }

  private hideWins(): void {
    this.reels.clearWins();
    this.winBanner.visible = false;
  }

  static async create(options: GameOptions): Promise<GameView> {
    await loadFonts();

    const app = new Application();

    await app.init({
      background: COLORS.background,
      // The platform decides how much of the page the game gets.
      resizeTo: options.host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    options.host.appendChild(app.canvas);

    return new GameView(app, options.formatMoney);
  }

  setActions(actions: PlayerActions): void {
    this.actions = actions;
  }

  /** `init.game`: the symbols and the grid to show when the session (re)starts. */
  show(game: unknown): void {
    const { symbols, grid } = GameInit.parse(game);

    this.reels.setSymbolPool(symbols);
    this.hideWins();
    this.reels.setGrid(grid);
    this.grid = grid;
  }

  update(state: HudState): void {
    this.spinEnabled = state.spinEnabled;

    this.controls.update({
      balance: this.formatMoney(state.balance),
      win: this.presenting ? null : this.formatMoney(state.win),
      bet: this.formatMoney(state.bet),
      step: this.formatMoney(state.step),
      spinEnabled: state.spinEnabled,
      betEnabled: state.betEnabled,
    });
  }

  /** Starts the reels as soon as the player spins, before the round arrives. */
  startSpin(): void {
    this.hideWins();
    this.reels.start();
  }

  /** Stops the reels on the round's grid and shows its wins. Resolves when the show is over. */
  async presentRound(outcome: unknown, summary: { totalWin: number }): Promise<void> {
    const { grid, wins } = SpinOutcome.parse(outcome);

    this.presenting = true;

    try {
      await this.reels.stop(grid);
      this.grid = grid;

      if (wins.length === 0) {
        return;
      }

      const total = this.formatMoney(summary.totalWin);

      this.reels.highlight(wins.flatMap((win) => win.positions));
      this.controls.setWin(total);
      this.winBanner.text = total;
      this.winBanner.visible = true;
      await this.clock.wait(TIMINGS.winShowMs);
      this.winBanner.visible = false;
    } finally {
      this.presenting = false;
    }
  }

  /** The spin was not played or failed: the reels stop on the grid they showed before. */
  async abortSpin(): Promise<void> {
    if (this.grid) {
      await this.reels.stop(this.grid);
    }
  }

  /** A platform window covers the game: freeze the animation and the game's time, ignore input. */
  pause(): void {
    this.paused = true;
    this.app.ticker.stop();
  }

  resume(): void {
    this.paused = false;
    this.app.ticker.start();
  }

  /** Screen rectangle (CSS pixels, relative to the viewport) of a control, for E2E tests. */
  getControlBounds(id: string): Bounds | null {
    const target = isControlId(id) ? this.controls.buttons[id] : undefined;

    if (!target || !isShown(target)) {
      return null;
    }

    const bounds = target.getBounds();
    const canvas = this.app.canvas.getBoundingClientRect();

    return {
      x: canvas.left + bounds.x,
      y: canvas.top + bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  /** What the reels show, for E2E tests. */
  getVisibleGrid(): Grid | null {
    return this.grid;
  }
}

function isShown(node: Container): boolean {
  for (let current: Container | null = node; current; current = current.parent) {
    if (!current.visible) {
      return false;
    }
  }

  return true;
}
