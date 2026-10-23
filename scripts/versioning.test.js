import { describe, expect, it } from "vitest";

import {
  decidingChange,
  isReleasedInChangelog,
  nextVersion,
  parseTitle,
  releaseChangelog,
  unreleasedNotes,
} from "./versioning.js";

const URL = "https://github.com/owner/repo";

describe("parseTitle", () => {
  it("reads type, scope, breaking mark and summary", () => {
    expect(parseTitle("fix(game): render the scene once")).toEqual({
      type: "fix",
      scope: "game",
      breaking: false,
      summary: "render the scene once",
    });

    expect(parseTitle("feat!: drop the old protocol")).toMatchObject({
      type: "feat",
      scope: undefined,
      breaking: true,
    });
  });

  it("rejects titles outside the convention", () => {
    expect(parseTitle("Fix the reels")).toHaveProperty("problem");
    expect(parseTitle("feature(game): add free spins")).toHaveProperty("problem");
    expect(parseTitle("fix(engine): old scope")).toHaveProperty("problem");
    expect(parseTitle("fix(game): Capitalised summary")).toHaveProperty("problem");
    expect(parseTitle("fix(game): trailing period.")).toHaveProperty("problem");
  });
});

describe("nextVersion", () => {
  it("raises patch for fixes, minor for features, nothing for the rest", () => {
    expect(nextVersion("0.2.0", { type: "fix", breaking: false })).toBe("0.2.1");
    expect(nextVersion("0.2.1", { type: "perf", breaking: false })).toBe("0.2.2");
    expect(nextVersion("0.2.1", { type: "feat", breaking: false })).toBe("0.3.0");
    expect(nextVersion("0.2.1", { type: "docs", breaking: false })).toBeNull();
    expect(nextVersion("0.2.1", { type: "chore", breaking: false })).toBeNull();
  });

  it("raises minor for a breaking change before 1.0, major after it", () => {
    expect(nextVersion("0.2.1", { type: "fix", breaking: true })).toBe("0.3.0");
    expect(nextVersion("1.4.2", { type: "feat", breaking: true })).toBe("2.0.0");
  });
});

describe("decidingChange", () => {
  const commit = (subject, body = "") => ({ subject, body });

  it("takes the strongest change among the merged pull requests", () => {
    expect(decidingChange([commit("docs: a guide"), commit("fix(game): a bug")])).toEqual({
      type: "fix",
      breaking: false,
    });

    expect(decidingChange([commit("fix(game): a bug"), commit("feat(client): a label")])).toEqual({
      type: "feat",
      breaking: false,
    });

    expect(
      decidingChange([commit("feat(client): a label"), commit("fix: a bug", "BREAKING CHANGE: x")]),
    ).toEqual({ type: "fix", breaking: true });
  });

  it("returns null when nothing releases", () => {
    expect(decidingChange([commit("docs: a guide"), commit("Merge something")])).toBeNull();
    expect(decidingChange([])).toBeNull();
  });
});

describe("unreleasedNotes", () => {
  it("returns the Unreleased body without the comparison links", () => {
    const changelog =
      "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- A bug.\n\n[Unreleased]: x\n";

    expect(unreleasedNotes(changelog)).toBe("### Fixed\n\n- A bug.");
    expect(unreleasedNotes("# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-22\n")).toBe("");
  });
});

describe("isReleasedInChangelog", () => {
  it("finds the version's section, not a mention or a link", () => {
    const changelog =
      "## [Unreleased]\n\n## [0.1.1] - 2026-10-23\n\n- Fixes 0.1.0.\n\n" +
      `[Unreleased]: ${URL}/compare/v0.1.1...HEAD\n[0.1.1]: ${URL}/compare/v0.1.0...v0.1.1\n`;

    expect(isReleasedInChangelog(changelog, "0.1.1")).toBe(true);
    expect(isReleasedInChangelog(changelog, "0.1.0")).toBe(false);
  });
});

describe("releaseChangelog", () => {
  it("moves the notes under the first version and adds its links", () => {
    const before = "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- The game.\n";

    expect(
      releaseChangelog(before, {
        version: "0.1.0",
        previous: null,
        date: "2026-10-22",
        repositoryUrl: URL,
      }),
    ).toBe(
      "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-22\n\n### Added\n\n- The game.\n\n" +
        `[Unreleased]: ${URL}/compare/v0.1.0...HEAD\n[0.1.0]: ${URL}/releases/tag/v0.1.0\n`,
    );
  });

  it("adds the next version and keeps the older links", () => {
    const before =
      "## [Unreleased]\n\n### Fixed\n\n- A bug.\n\n## [0.1.0] - 2026-10-22\n\n- The game.\n\n" +
      `[Unreleased]: ${URL}/compare/v0.1.0...HEAD\n[0.1.0]: ${URL}/releases/tag/v0.1.0\n`;

    expect(
      releaseChangelog(before, {
        version: "0.1.1",
        previous: "0.1.0",
        date: "2026-10-23",
        repositoryUrl: URL,
      }),
    ).toBe(
      "## [Unreleased]\n\n## [0.1.1] - 2026-10-23\n\n### Fixed\n\n- A bug.\n\n" +
        "## [0.1.0] - 2026-10-22\n\n- The game.\n\n" +
        `[Unreleased]: ${URL}/compare/v0.1.1...HEAD\n[0.1.1]: ${URL}/compare/v0.1.0...v0.1.1\n` +
        `[0.1.0]: ${URL}/releases/tag/v0.1.0\n`,
    );
  });
});
