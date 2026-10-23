/**
 * The build's version in the bottom-left corner: the platform's, like its system windows
 * (ADR 014). The glitch layers repeat the text from `data-text` (see `styles.css`).
 */
export function showVersion(host: HTMLElement, version: string): void {
  const label = document.createElement("div");
  const text = `v${version}`;

  label.className = "platform-version";
  label.dataset.testid = "platform-version";
  label.dataset.text = text;
  label.textContent = text;
  label.setAttribute("aria-label", `Version ${version}`);
  host.append(label);
}
