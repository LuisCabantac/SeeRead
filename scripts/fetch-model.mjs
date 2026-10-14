#!/usr/bin/env node
// Downloads the default speech model, verifies its SHA-256, and installs the quantized
// files into src-tauri/resources/models/ (bundled with release builds). Test recordings
// from the same archive go to .cache/test_wavs for the speech fixture tests.
//
// Usage: node scripts/fetch-model.mjs [--force]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = {
  name: "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17",
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17.tar.bz2",
  sha256: "9c559283e8498d3fe95913c79ca1cb454bb26281ac2b102b41306c7d752765d9",
  installAs: "en-us-zipformer-20M",
  files: [
    "encoder-epoch-99-avg-1.int8.onnx",
    "decoder-epoch-99-avg-1.int8.onnx",
    "joiner-epoch-99-avg-1.int8.onnx",
    "tokens.txt",
    "README.md",
  ],
  testFiles: ["test_wavs/0.wav", "test_wavs/1.wav", "test_wavs/trans.txt"],
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, ".cache");
const archive = join(cache, `${MODEL.name}.tar.bz2`);
const target = join(root, "src-tauri", "resources", "models", MODEL.installAs);
const force = process.argv.includes("--force");

function sha256(file) {
  return new Promise((ok, fail) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (d) => hash.update(d))
      .on("end", () => ok(hash.digest("hex")))
      .on("error", fail);
  });
}

async function download() {
  console.log(`Downloading ${MODEL.url}`);
  const res = await fetch(MODEL.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  await writeFile(archive, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  if (!force && MODEL.files.every((f) => existsSync(join(target, f)))) {
    console.log(`Model already installed in ${target}`);
    return;
  }
  mkdirSync(cache, { recursive: true });
  if (force || !existsSync(archive) || (await sha256(archive)) !== MODEL.sha256) await download();

  const actual = await sha256(archive);
  if (actual !== MODEL.sha256) {
    rmSync(archive, { force: true });
    throw new Error(`Checksum mismatch for ${MODEL.name}: expected ${MODEL.sha256}, got ${actual}`);
  }
  console.log("Checksum verified.");

  const wanted = [...MODEL.files, ...MODEL.testFiles].map((f) => `${MODEL.name}/${f}`);
  // bsdtar (Windows 10+, macOS) and GNU tar (Linux) both read bzip2 archives. On Windows,
  // call the system bsdtar explicitly: a GNU tar from Git Bash misreads "C:" as a host name.
  const tar =
    process.platform === "win32"
      ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
      : "tar";
  execFileSync(tar, ["-xjf", archive, "-C", cache, ...wanted], { stdio: "inherit" });

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const f of MODEL.files) copyFileSync(join(cache, MODEL.name, f), join(target, f));
  const wavs = join(cache, "test_wavs");
  mkdirSync(wavs, { recursive: true });
  for (const f of MODEL.testFiles) copyFileSync(join(cache, MODEL.name, f), join(cache, f));
  console.log(`Installed model to ${target}`);
  console.log(`Test recordings in ${wavs}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
