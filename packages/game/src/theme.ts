/** Layout and colours of the placeholder UI. The scene is designed at 1280×720 and scaled to fit. */
export const SCENE = { width: 1280, height: 720 } as const;

export const REEL_LAYOUT = {
  cellWidth: 160,
  cellHeight: 136,
  gap: 12,
  top: 96,
} as const;

export const COLORS = {
  background: 0x07070d,
  panel: 0x12121f,
  yellow: 0xfcee0a,
  cyan: 0x00f0ff,
  text: 0xe8e8f0,
  textDim: 0x8a8aa3,
  disabled: 0x3a3a4a,
} as const;

/** The game's web font. The game loads it itself: the platform knows nothing about its look. */
export const FONT_FAMILY = "Rajdhani";
export const FONT_WEIGHTS = ["600", "700"] as const;

export const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap";

export const FONT = `${FONT_FAMILY}, "Segoe UI", Roboto, Arial, sans-serif`;

/** Animation timings in one place, so a Turbo mode can swap them later. */
export const TIMINGS = {
  /** Delay between stopping consecutive reels. */
  reelStopDelayMs: 140,
  /** Reel speed while spinning, in scene pixels per millisecond. */
  reelSpeedPxPerMs: 2.6,
  /** Settle animation after a reel lands. */
  reelSettleMs: 160,
  /** How long a win is shown. */
  winShowMs: 1500,
} as const;
