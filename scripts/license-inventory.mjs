#!/usr/bin/env node
// Writes a plain-text inventory of every third-party component that ships in the app:
// production npm packages, Rust crates in the build graph, and the bundled speech model.
// Usage: node scripts/license-inventory.mjs [output-file]   (default: stdout)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });

const npm = JSON.parse(
  run("npx", ["license-checker-rseidelsohn", "--production", "--excludePrivatePackages", "--json"]),
);
const cargo = JSON.parse(
  run("cargo", [
    "metadata",
    "--format-version",
    "1",
    "--locked",
    "--manifest-path",
    "src-tauri/Cargo.toml",
  ]),
);
const ownName = JSON.parse(readFileSync(new URL("package.json", root), "utf8")).name;

const lines = [
  "SeeRead third-party license inventory",
  `Generated ${new Date().toISOString().slice(0, 10)}. Full license texts are available from each project's source.`,
  "",
  "== Speech model ==",
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17 (k2-fsa): Apache-2.0",
  "",
  "== JavaScript packages (bundled into the user interface) ==",
];
for (const [pkg, info] of Object.entries(npm).sort()) {
  if (!pkg.startsWith(`${ownName}@`))
    lines.push(`${pkg}: ${info.licenses}${info.repository ? ` — ${info.repository}` : ""}`);
}
lines.push("", "== Rust crates (full dependency graph, all platforms) ==");
for (const p of cargo.packages
  .filter((p) => p.source) // skip SeeRead itself
  .sort((a, b) => a.name.localeCompare(b.name))) {
  lines.push(
    `${p.name}@${p.version}: ${p.license ?? "see repository"}${p.repository ? ` — ${p.repository}` : ""}`,
  );
}

const out = `${lines.join("\n")}\n`;
if (process.argv[2]) writeFileSync(process.argv[2], out);
else process.stdout.write(out);
