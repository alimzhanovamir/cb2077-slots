import { Container, Graphics, Text } from "pixi.js";

import { texts } from "../texts.ts";
import { COLORS, FONT, SCENE } from "../theme.ts";
import { Button } from "./Button.ts";

export type ControlId = "spin" | "betUp" | "betDown" | "step";

const CONTROL_IDS: ReadonlySet<string> = new Set<ControlId>(["spin", "betUp", "betDown", "step"]);

export function isControlId(id: string): id is ControlId {
  return CONTROL_IDS.has(id);
}

export type ControlsHandlers = {
  spin: () => void;
  betUp: () => void;
  betDown: () => void;
  step: () => void;
};

export type ControlsState = {
  balance: string;
  /** `null` keeps the win shown now (a round's win while it is presented). */
  win: string | null;
  bet: string;
  step: string;
  spinEnabled: boolean;
  betEnabled: boolean;
};

/** Bottom bar: balance, win, bet − / +, step, spin. */
export class ControlsPanel extends Container {
  readonly buttons: Record<ControlId, Button>;
  private readonly balanceValue: Text;
  private readonly winValue: Text;
  private readonly betValue: Text;

  constructor(handlers: ControlsHandlers) {
    super();

    const top = 560;

    const bar = new Graphics()
      .rect(0, top, SCENE.width, SCENE.height - top)
      .fill({ color: COLORS.panel })
      .rect(0, top, SCENE.width, 2)
      .fill({ color: COLORS.yellow });

    this.addChild(bar);
    this.balanceValue = this.addField(texts.balance, 40, top + 30, 260);
    this.winValue = this.addField(texts.win, 320, top + 30, 200);
    this.betValue = this.addField(texts.bet, 610, top + 30, 140, "center");

    this.buttons = {
      betDown: new Button({ width: 56, height: 56, label: "−", fontSize: 32 }, handlers.betDown),
      betUp: new Button({ width: 56, height: 56, label: "+", fontSize: 32 }, handlers.betUp),
      step: new Button({ width: 140, height: 40, label: "", fontSize: 18 }, handlers.step),
      spin: new Button(
        {
          width: 132,
          height: 132,
          label: texts.spin,
          fontSize: 30,
          color: COLORS.yellow,
          shape: "circle",
        },
        handlers.spin,
      ),
    };

    this.buttons.betDown.position.set(540, top + 36);
    this.buttons.betUp.position.set(764, top + 36);
    this.buttons.step.position.set(610, top + 104);
    this.buttons.spin.position.set(900, top + 6);
    this.addChild(...Object.values(this.buttons));
  }

  private addField(
    label: string,
    x: number,
    y: number,
    width: number,
    align: "left" | "center" = "left",
  ): Text {
    const caption = new Text({
      text: label,
      style: {
        fontFamily: FONT,
        fontSize: 16,
        fontWeight: "600",
        fill: COLORS.textDim,
        letterSpacing: 2,
      },
    });

    const value = new Text({
      text: "",
      style: { fontFamily: FONT, fontSize: 30, fontWeight: "700", fill: COLORS.text },
    });

    if (align === "center") {
      caption.anchor.set(0.5, 0);
      value.anchor.set(0.5, 0);
      caption.position.set(x + width / 2, y);
      value.position.set(x + width / 2, y + 22);
    } else {
      caption.position.set(x, y);
      value.position.set(x, y + 22);
    }

    this.addChild(caption, value);

    return value;
  }

  /** Shows a win during its presentation, before the platform confirms the round. */
  setWin(win: string): void {
    this.winValue.text = win;
  }

  update(state: ControlsState): void {
    this.balanceValue.text = state.balance;

    if (state.win !== null) {
      this.winValue.text = state.win;
    }

    this.betValue.text = state.bet;
    this.buttons.step.setLabel(texts.step(state.step));

    const { spin, betUp, betDown, step } = this.buttons;

    spin.setEnabled(state.spinEnabled);

    for (const button of [betUp, betDown, step]) {
      button.setEnabled(state.betEnabled);
    }
  }
}
