# Development setup

## Prerequisites

| Tool                      | Version                          | Notes                                                                   |
| ------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| Node.js                   | 24 LTS (see `.nvmrc`); 22+ works | npm is used; `npm ci` installs the exact lockfile                       |
| Rust                      | pinned in `rust-toolchain.toml`  | install with [rustup](https://rustup.rs); it picks the pin              |
| Tauri system dependencies | —                                | [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/) |

Platform specifics:

- **Windows:** Microsoft C++ Build Tools ("Desktop development with C++") and WebView2 (preinstalled on
  Windows 11). The project links the static C runtime (`src-tauri/.cargo/config.toml`) because the
  sherpa-onnx static libraries are built with `/MT`.
- **macOS:** Xcode Command Line Tools.
- **Linux (Debian/Ubuntu):**

  ```sh
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
    libayatana-appindicator3-dev librsvg2-dev libasound2-dev
  ```

The first Rust build downloads prebuilt sherpa-onnx static libraries from the sherpa-onnx GitHub
release that matches the crate version (done by the `sherpa-onnx-sys` build script). To build offline
or from audited archives, set `SHERPA_ONNX_LIB_DIR` to a directory containing the extracted libraries.

## First run

```sh
npm ci
npm run fetch:model   # ~128 MB download once; verifies SHA-256, installs ~44 MB of model files
npm run tauri dev
```

`fetch:model` installs the model into `src-tauri/resources/models/` (git-ignored) and test recordings
into `.cache/test_wavs/`. Without it the app still runs; voice tracking reports that no model is
installed.

## Working without the native shell

`npm run dev` serves the UI at <http://localhost:1420> in a normal browser. Outside Tauri, SeeRead
switches to browser fallbacks: settings in `localStorage`, a `BroadcastChannel` between the main window
and the teleprompter (opened as a popup), and a demo recognizer that "reads" the script aloud. This is
how the Playwright E2E suite runs, and it is handy for UI work.

## Project layout

```text
src/core/            Pure logic (no DOM/Tauri): annotations, tokens, matcher, autoscroll, geometry,
                     render model, settings schema, shortcuts, stats
src/services/        Adapters: Tauri commands/events with browser fallbacks
src/features/        UI by feature: script-editor, teleprompter, voice-tracking, auto-scroll,
                     annotations, settings, first-run
src/app/             Main window shell          src/overlay/   Teleprompter window + playback engine
src/styles/          CSS tokens and component styles
src-tauri/src/       Rust: speech.rs (cpal + sherpa-onnx), capture_exclusion.rs, storage.rs, lib.rs
src-tauri/capabilities/  Per-window permissions
tests/               unit/, integration/, e2e/, bench/, fixtures/
scripts/             fetch-model, license-inventory, check-version, extract-changelog
```

## Useful commands

```sh
npm run check            # prettier --check, eslint, tsc, vitest
npm run test:e2e         # Playwright (builds and serves the UI)
npm run bench            # matcher/auto-scroll micro-benchmarks
npm run licenses:check   # npm production license allow-list
cd src-tauri
cargo test               # Rust unit tests
cargo test -- --ignored  # real-audio speech test (needs fetch:model)
cargo deny check         # advisories, licenses, sources (install: cargo install cargo-deny)
```

## Troubleshooting

- **`LNK2038`/`LNK4098` runtime-library mismatch on Windows:** make sure you build from `src-tauri`
  so `.cargo/config.toml` applies (`+crt-static`).
- **`could not find native static library sherpa-onnx-c-api`:** the downloaded libraries in
  `src-tauri/target/sherpa-onnx-prebuilt/` were removed but Cargo still has the build-script results.
  Run `cargo clean -p sherpa-onnx-sys` in `src-tauri/` to download them again.
- **Files locked during builds on OneDrive/Dropbox folders:** exclude `node_modules/` and
  `src-tauri/target/` from sync, or set `CARGO_TARGET_DIR` to a folder outside the synced tree.
- **Linux: the overlay isn't transparent or on top:** this depends on your compositor; see
  [platform support](../platform-support.md).
