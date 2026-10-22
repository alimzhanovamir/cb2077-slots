import { FONT_FAMILY, FONT_STYLESHEET, FONT_WEIGHTS } from "./theme.ts";

/**
 * Loads the game's web font before anything is drawn: canvas text is rasterised once, so a label
 * drawn before the font arrives stays in the fallback font. If the font fails to load, the game
 * starts with the fallback.
 */
export async function loadFonts(): Promise<void> {
  const link = document.createElement("link");

  link.rel = "stylesheet";
  link.href = FONT_STYLESHEET;

  const settled = new Promise<void>((resolve) => {
    link.addEventListener("load", () => {
      resolve();
    });

    link.addEventListener("error", () => {
      resolve();
    });
  });

  document.head.append(link);
  await settled;

  await Promise.all(
    FONT_WEIGHTS.map((weight) =>
      document.fonts.load(`${weight} 20px ${FONT_FAMILY}`).catch(() => undefined),
    ),
  );
}
