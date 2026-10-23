/**
 * Versioning rules (CONTRIBUTING.md, "Versions"): the title of a merged pull request decides the
 * next version, and the pull request's `Unreleased` notes become that version's CHANGELOG
 * section. Pure functions, used by `release.js` and `check-pull-request.js`.
 */

export const TYPES = ["feat", "fix", "docs", "refactor", "test", "chore", "ci", "perf", "style"];

export const SCOPES = ["client", "game", "rgs", "math", "server", "shared", "e2e", "docs", "ci"];

/** Types that change what the player gets, so they need a CHANGELOG entry and a release. */
export const RELEASING_TYPES = ["feat", "fix", "perf"];

const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9-]+)\))?(?<breaking>!)?: (?<summary>.+)$/;

/**
 * Parses a Conventional Commits title (`fix(game): render once`). Returns `null` when the title
 * does not follow the format, with the reason in `problem`.
 *
 * @param {string} title
 * @returns {{ type: string, scope: string | undefined, breaking: boolean, summary: string } | { problem: string }}
 */
export function parseTitle(title) {
  const match = TITLE.exec(title.trim());

  if (!match?.groups) {
    return { problem: "expected `<type>(<scope>): <summary>`, e.g. `fix(game): render once`" };
  }

  const { type = "", scope, breaking, summary = "" } = match.groups;

  if (!TYPES.includes(type)) {
    return { problem: `unknown type "${type}"; use one of: ${TYPES.join(", ")}` };
  }

  if (scope !== undefined && !SCOPES.includes(scope)) {
    return { problem: `unknown scope "${scope}"; use one of: ${SCOPES.join(", ")}` };
  }

  if (!/^[a-z0-9`]/.test(summary) || summary.endsWith(".")) {
    return { problem: "the summary starts in lower case and has no trailing period" };
  }

  return { type, scope, breaking: breaking === "!", summary };
}

/**
 * The version after a merged pull request, or `null` when it releases nothing.
 *
 * @param {string} current Version in `package.json`, e.g. `0.2.0`.
 * @param {{ type: string, breaking: boolean }} change
 * @returns {string | null}
 */
export function nextVersion(current, change) {
  const [major = 0, minor = 0, patch = 0] = current.split(".").map(Number);

  if (change.breaking) {
    // Before 1.0 a breaking change raises the minor part; 1.0.0 is set by hand.
    return major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
  }

  if (change.type === "feat") {
    return `${major}.${minor + 1}.0`;
  }

  if (change.type === "fix" || change.type === "perf") {
    return `${major}.${minor}.${patch + 1}`;
  }

  return null;
}

/**
 * The `Unreleased` section's body (without its heading), trimmed.
 *
 * @param {string} changelog
 * @returns {string}
 */
export function unreleasedNotes(changelog) {
  const start = changelog.indexOf("## [Unreleased]");

  if (start === -1) {
    return "";
  }

  const bodyStart = changelog.indexOf("\n", start) + 1;
  const next = changelog.indexOf("\n## [", bodyStart);

  return (
    changelog
      .slice(bodyStart, next === -1 ? undefined : next)
      .split("\n[")[0]
      ?.trim() ?? ""
  );
}

/**
 * Moves the `Unreleased` notes under a new version heading and updates the comparison links at the
 * end of the file.
 *
 * @param {string} changelog
 * @param {{ version: string, previous: string | null, date: string, repositoryUrl: string }} release
 * @returns {string}
 */
export function releaseChangelog(changelog, { version, previous, date, repositoryUrl }) {
  const heading = "## [Unreleased]";

  if (!changelog.includes(heading)) {
    throw new Error("CHANGELOG.md has no `## [Unreleased]` section");
  }

  let text = changelog.replace(heading, `${heading}\n\n## [${version}] - ${date}`);
  const unreleasedLink = `[Unreleased]: ${repositoryUrl}/compare/v${version}...HEAD`;

  const versionLink = previous
    ? `[${version}]: ${repositoryUrl}/compare/v${previous}...v${version}`
    : `[${version}]: ${repositoryUrl}/releases/tag/v${version}`;

  text = /^\[Unreleased\]: .*$/m.test(text)
    ? text.replace(/^\[Unreleased\]: .*$/m, `${unreleasedLink}\n${versionLink}`)
    : `${text.trimEnd()}\n\n${unreleasedLink}\n${versionLink}\n`;

  return text.replace(/\n{3,}/g, "\n\n");
}
