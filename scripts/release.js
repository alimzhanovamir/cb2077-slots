/**
 * Runs in the `release` workflow after every merge into `main`, or by hand (CONTRIBUTING.md,
 * "Versions"). Works out the next version from the titles of the pull requests merged since the
 * last release, writes it to `package.json` and moves the `Unreleased` notes in `CHANGELOG.md`
 * under it. The workflow commits, tags and pushes. Outputs `released` and `version` for the
 * workflow.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import {
  decidingChange,
  isReleasedInChangelog,
  nextVersion,
  parseTitle,
  releaseChangelog,
  RELEASING_TYPES,
  unreleasedNotes,
} from "./versioning.js";

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

/** Commits merged since the given release (all of them before the first one), oldest first. */
function commitsSince(version) {
  const range = version ? [`v${version}..HEAD`] : ["HEAD"];

  return git("log", "--reverse", "--format=%s%x1f%b%x1e", ...range)
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject = "", body = ""] = entry.split("\x1f");

      return { subject: subject.trim(), body: body.trim() };
    })
    .filter(({ subject }) => !subject.startsWith("chore(release):"));
}

function main() {
  const manifestText = readFileSync("package.json", "utf8");
  const current = JSON.parse(manifestText).version;
  const released = releasedVersions();
  const commits = commitsSince(released[0]);
  let version = null;

  if (!released.includes(current)) {
    // A version set by hand in a pull request (the first one, or 1.0.0) is released as it is, and
    // so is a release commit that landed without its tag.
    version = current;
  } else {
    const change = decidingChange(commits);

    version = change ? nextVersion(current, change) : null;
  }

  if (!version) {
    console.log(
      `${commits.length} pull request(s) merged since v${current}, none releases anything`,
    );

    output({ released: false });

    return;
  }

  let changelog = readFileSync("CHANGELOG.md", "utf8");

  if (isReleasedInChangelog(changelog, version)) {
    // The release commit landed without its tag: only the tag is left to push.
    console.log(`v${version} is already in CHANGELOG.md; tagging it`);
    output({ released: true, version });

    return;
  }

  if (!unreleasedNotes(changelog)) {
    // The pull request check asks for notes; without them the titles are the notes.
    const notes = commits
      .map(({ subject }) => parseTitle(subject))
      .filter(
        (change) => "type" in change && (RELEASING_TYPES.includes(change.type) || change.breaking),
      )
      .map((change) => `- ${change.summary}`);

    changelog = changelog.replace(
      "## [Unreleased]",
      `## [Unreleased]\n\n### Changed\n\n${notes.join("\n") || `- Version ${version}.`}`,
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
