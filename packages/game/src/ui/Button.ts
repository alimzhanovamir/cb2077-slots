import { Container, Graphics, Text } from "pixi.js";

import { COLORS, FONT } from "../theme.ts";

export type ButtonOptions = {
  width: number;
  height: number;
  label: string;
  color?: number;
  fontSize?: number;
  shape?: "rect" | "circle";
};

/** Placeholder canvas button: a neon outline with a label. */
export class Button extends Container {
  private readonly background = new Graphics();
  private readonly text: Text;
  private enabled = true;
  private readonly color: number;

  constructor(
    private readonly options: ButtonOptions,
    onPress: () => void,
  ) {
    super();
    this.color = options.color ?? COLORS.cyan;

    this.text = new Text({
      text: options.label,
      style: {
        fontFamily: FONT,
        fontSize: options.fontSize ?? 22,
        fontWeight: "700",
        fill: COLORS.text,
      },
    });

    this.text.anchor.set(0.5);
    this.text.position.set(options.width / 2, options.height / 2);
    this.addChild(this.background, this.text);
    this.eventMode = "static";
    this.cursor = "pointer";

    this.on("pointertap", () => {
      if (this.enabled) {
        onPress();
      }
    });

    this.redraw();
  }

  private redraw(): void {
    const { width, height, shape } = this.options;
    const color = this.enabled ? this.color : COLORS.disabled;
    const fill = { color: COLORS.panel };

    this.background.clear();

    if (shape === "circle") {
      const radius = Math.min(width, height) / 2;

      this.background
        .circle(width / 2, height / 2, radius)
        .fill(fill)
        .stroke({ width: 4, color });
    } else {
      this.background.roundRect(0, 0, width, height, 8).fill(fill).stroke({ width: 2, color });
    }

    this.text.style.fill = this.enabled ? COLORS.text : COLORS.textDim;
  }

  setLabel(label: string): void {
    this.text.text = label;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }

    this.enabled = enabled;
    this.cursor = enabled ? "pointer" : "default";
    this.redraw();
  }
}
