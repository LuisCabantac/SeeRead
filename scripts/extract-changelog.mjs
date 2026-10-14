#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version, for use as GitHub release notes.
// Usage: node scripts/extract-changelog.mjs 1.2.3
import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const start = changelog.indexOf(`## [${version}]`);
if (!version || start === -1) {
  console.error(`No changelog section for ${version || "(missing version)"}`);
  process.exit(1);
}
const next = changelog.indexOf("\n## [", start + 1);
const body = changelog
  .slice(changelog.indexOf("\n", start) + 1, next === -1 ? undefined : next)
  .split("\n")
  .filter((line) => !/^\[[^\]]+\]: https?:\/\//.test(line)) // comparison-link footer
  .join("\n");
process.stdout.write(`${body.trim()}\n`);
