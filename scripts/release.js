/**
 * Runs in the `release` workflow after every push to `main` (CONTRIBUTING.md, "Versions"). Works
 * out the next version from the merged pull request's title, writes it to `package.json` and moves
 * the `Unreleased` notes in `CHANGELOG.md` under it. The workflow commits, tags and pushes.
 * Outputs `released` and `version` for the workflow.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import { nextVersion, parseTitle, releaseChangelog, unreleasedNotes } from "./versioning.js";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function output(values) {
  for (const [name, value] of Object.entries(values)) {
    console.log(`${name}=${value}`);

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    }
  }
}

function repositoryUrl() {
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
    return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  }

  const remote = git("remote", "get-url", "origin");

  const path = remote
    .replace(/^git@github\.com:|^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "");

  return `https://github.com/${path}`;
}

/** Released versions, newest first. */
function releasedVersions() {
  return git("tag", "--list", "v*")
    .split("\n")
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map((tag) => tag.slice(1))
    .sort((left, right) => {
      const a = left.split(".").map(Number);
      const b = right.split(".").map(Number);

      return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
    });
}

function main() {
  const subject = git("log", "-1", "--format=%s");
  const body = git("log", "-1", "--format=%b");

  if (subject.startsWith("chore(release):")) {
    output({ released: false });

    return;
  }

  const manifestText = readFileSync("package.json", "utf8");
  const current = JSON.parse(manifestText).version;
  const released = releasedVersions();
  const change = parseTitle(subject);
  let version = null;

  if (!released.includes(current)) {
    // A version set by hand in a pull request (the first one, or 1.0.0) is released as it is.
    version = current;
  } else if ("type" in change) {
    version = nextVersion(current, {
      type: change.type,
      breaking: change.breaking || /^BREAKING CHANGE:/m.test(body),
    });
  }

  if (!version) {
    console.log(`"${subject}" releases nothing`);
    output({ released: false });

    return;
  }

  let changelog = readFileSync("CHANGELOG.md", "utf8");

  if (!unreleasedNotes(changelog)) {
    // The pull request check asks for notes; without them the title is the note.
    const summary = "summary" in change ? change.summary : subject;

    changelog = changelog.replace(
      "## [Unreleased]",
      `## [Unreleased]\n\n### Changed\n\n- ${summary}`,
    );
  }

  writeFileSync(
    "package.json",
    manifestText.replace(/"version": "[^"]*"/, `"version": "${version}"`),
  );

  writeFileSync(
    "CHANGELOG.md",
    releaseChangelog(changelog, {
      version,
      previous: released.find((candidate) => candidate !== version) ?? null,
      date: new Date().toISOString().slice(0, 10),
      repositoryUrl: repositoryUrl(),
    }),
  );

  output({ released: true, version });
}

main();
