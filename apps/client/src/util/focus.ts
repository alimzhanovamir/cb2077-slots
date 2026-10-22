/**
 * A button clicked with the mouse or a tap gives the focus back to the page, so the keyboard keeps
 * controlling the game: otherwise Space would press that button again instead of spinning. A
 * button pressed from the keyboard (a click with `detail` 0) keeps the focus.
 */
export function releaseFocusAfterPointerClick(button: HTMLButtonElement): void {
  button.addEventListener("click", (event) => {
    if (event.detail > 0) {
      button.blur();
    }
  });
}
