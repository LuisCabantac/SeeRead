#!/usr/bin/env node
// Verifies that a release tag matches every version declaration and has a changelog entry.
// Usage: node scripts/check-version.mjs v1.2.3
import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? "";
const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
if (!match) {
  console.error(`"${tag}" is not a Semantic Versioning tag like v1.2.3 or v1.2.3-rc.1`);
  process.exit(1);
}
const version = match[1];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const found = {
  "package.json": JSON.parse(read("package.json")).version,
  "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": /^version\s*=\s*"([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))?.[1],
};

let ok = true;
for (const [file, v] of Object.entries(found)) {
  if (v !== version) {
    console.error(`${file} has version ${v}, but the tag is ${tag}`);
    ok = false;
  }
}
if (!read("CHANGELOG.md").includes(`## [${version}]`)) {
  console.error(`CHANGELOG.md has no "## [${version}]" section`);
  ok = false;
}
if (!ok) process.exit(1);
console.log(`Version ${version} is consistent.`);
