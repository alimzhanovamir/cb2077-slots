/**
 * Runs on every pull request (CONTRIBUTING.md, "Pull requests"): the title follows Conventional
 * Commits, because it becomes the commit message and decides the next version; a `feat`, `fix`
 * or `perf` pull request adds its CHANGELOG entry under `Unreleased`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { parseTitle, RELEASING_TYPES, unreleasedNotes } from "./versioning.js";

function fail(message) {
  // `::error::` shows the message as an annotation on the pull request.
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

const title = process.env.PULL_REQUEST_TITLE ?? "";
const base = process.env.BASE_SHA ?? "origin/main";
const change = parseTitle(title);

if ("problem" in change) {
  fail(`Pull request title "${title}": ${change.problem}.`);
} else if (RELEASING_TYPES.includes(change.type) || change.breaking) {
  const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .includes("CHANGELOG.md");

  if (!changed || !unreleasedNotes(readFileSync("CHANGELOG.md", "utf8"))) {
    fail(
      `A \`${change.type}\` pull request releases a new version: add its entry under ` +
        "`## [Unreleased]` in CHANGELOG.md.",
    );
  }
}

if (!process.exitCode) {
  console.log(`OK: "${title}"`);
}
