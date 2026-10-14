# Testing

SeeRead follows a testing pyramid: most behaviour lives in pure functions with fast unit tests, a
smaller set of integration tests drives those functions with real recorded data, and E2E tests cover
user flows. Native window behaviour is validated by hand and recorded in
[platform-support.md](../platform-support.md).

| Layer             | Where                                                                           | Runs in CI             | What it covers                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (TS)         | `tests/unit/`                                                                   | `web` job              | Annotation parser and delimiters, Unicode, position mapping, normalization and number expansion, matcher (ambiguity, repeats, pauses, skips, errors, out-of-order, revisions, lost/recovery, long scripts), auto-scroll physics, settings sanitizing, shortcuts, geometry, render model                                   |
| Integration (TS)  | `tests/integration/`                                                            | `web` job              | Voice tracker driven by **real recognizer output** recorded from LibriSpeech audio, across stage directions and paragraphs                                                                                                                                                                                                |
| Unit (Rust)       | `src-tauri/src/*` `#[cfg(test)]`                                                | `rust` matrix (3 OSes) | Atomic writes, draft round-trip, file-type checks, model discovery, hotword filtering                                                                                                                                                                                                                                     |
| Real audio (Rust) | `speech.rs` `recognizes_recorded_speech` (ignored by default)                   | `speech` job (Ubuntu)  | sherpa-onnx recognizes recordings with ≥80% word accuracy; can regenerate `tests/fixtures/asr/`                                                                                                                                                                                                                           |
| Real audio (Rust) | `speech.rs` `primes_at_device_rate_across_endpoint_resets` (ignored by default) | `speech` job (Ubuntu)  | A stream reset at an endpoint keeps working at a non-16 kHz microphone rate (sherpa-onnx exits the process on a rate change)                                                                                                                                                                                              |
| E2E (Playwright)  | `tests/e2e/`                                                                    | `e2e` job              | First run, paste/copy/undo/find-replace, autosave recovery, settings persistence, shortcut recording and conflicts, stage-direction settings, auto-scroll start/pause/stop/restart, countdown, overlay keys, voice mode highlighting with a demo recognizer, mode switching, click-to-reposition, axe accessibility scans |
| Build             | `tauri build --debug --no-bundle`                                               | `rust` matrix          | The full app compiles and links on each OS                                                                                                                                                                                                                                                                                |
| Manual            | [platform-support.md](../platform-support.md)                                   | —                      | Transparency, always-on-top, click-through, capture exclusion, live microphone, multi-monitor/DPI                                                                                                                                                                                                                         |

## Recorded speech fixtures

`tests/fixtures/asr/*.json` contain the partial-result stream the speech engine produced for public
LibriSpeech recordings (see `tests/fixtures/README.md`). To regenerate after changing the engine or
model:

```sh
npm run fetch:model
cd src-tauri && SEEREAD_WRITE_FIXTURES=1 cargo test recognizes_recorded_speech -- --ignored
```

## What E2E does not cover

E2E runs the web UI in Chromium. It cannot check OS window flags, global shortcuts, the tray, real
microphones or capture exclusion. Those are covered by the native checks in
[platform-support.md](../platform-support.md). `tauri-driver` WebDriver tests could automate some of
this on Windows and Linux in future (macOS has no WebDriver support for WKWebView).

## Writing tests

- Put new pure logic in `src/core/` and test it directly.
- Matcher changes need a test that would have failed before the change, and must keep
  `tests/integration/voice-fixture.test.ts` green.
- Don't commit private scripts or voice recordings as fixtures; use public-domain material.
