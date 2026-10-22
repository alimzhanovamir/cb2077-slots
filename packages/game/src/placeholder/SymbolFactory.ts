import { Container, Graphics, Text } from "pixi.js";

import type { SymbolId } from "@cb2077/shared/game";

import { COLORS, FONT } from "../theme.ts";

/** Placeholder look per symbol: a coloured tile with a label. Replaced by real art later. */
const LOOK: Record<SymbolId, { color: number; label: string }> = {
  chip: { color: 0x2f6f73, label: "CHIP" },
  eddie: { color: 0x3d7a3a, label: "EDDIE" },
  implant: { color: 0x5a4b8a, label: "IMPLANT" },
  deck: { color: 0x3b5b8f, label: "DECK" },
  pistol: { color: 0x9a6a1f, label: "PISTOL" },
  katana: { color: 0xa33b3b, label: "KATANA" },
  solo: { color: 0xb0256d, label: "SOLO" },
  netrunner: { color: 0xc9b400, label: "NETRUNNER" },
};

/** One symbol cell. Views are recycled while reels spin, so the symbol can be changed. */
export class SymbolView extends Container {
  private readonly tile = new Graphics();
  private readonly highlight = new Graphics();
  private readonly caption: Text;
  private current: SymbolId | null = null;

  constructor(
    private readonly cellWidth: number,
    private readonly cellHeight: number,
  ) {
    super();

    this.caption = new Text({
      text: "",
      style: {
        fontFamily: FONT,
        fontSize: 24,
        fontWeight: "700",
        fill: COLORS.text,
        letterSpacing: 1,
      },
    });

    this.caption.anchor.set(0.5);
    this.caption.position.set(cellWidth / 2, cellHeight / 2);
    this.highlight.visible = false;
    this.addChild(this.tile, this.caption, this.highlight);
  }

  setSymbol(id: SymbolId): void {
    if (id === this.current) {
      return;
    }

    this.current = id;

    const { color, label } = LOOK[id];
    const inset = 6;

    this.tile
      .clear()
      .roundRect(inset, inset, this.cellWidth - inset * 2, this.cellHeight - inset * 2, 10)
      .fill({ color })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.15 });

    this.caption.text = label;
  }

  setHighlighted(on: boolean): void {
    this.highlight
      .clear()
      .roundRect(2, 2, this.cellWidth - 4, this.cellHeight - 4, 12)
      .stroke({ width: 4, color: COLORS.yellow });

    this.highlight.visible = on;
  }

  setDimmed(on: boolean): void {
    this.alpha = on ? 0.35 : 1;
  }
}
