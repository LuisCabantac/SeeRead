# 0003: On-device speech recognition with sherpa-onnx

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Voice tracking needs low-latency, streaming (partial) results on Windows, macOS and Linux, fully
offline, under a licence compatible with Apache-2.0, without requiring an account or API key.

## Options considered

1. **sherpa-onnx** (k2-fsa, Apache-2.0) — streaming zipformer transducers, official Rust crate
   (`sherpa-onnx` 1.13.x) with prebuilt static libraries for all three desktop platforms, active
   releases (Sept 2026), optional hotword biasing for BPE models, built-in resampling.
2. **Vosk** (Apache-2.0) — streaming and grammar-restricted recognition, but the last native library
   release is from 2022 and there is no current macOS library.
3. **whisper.cpp** — accurate, but not natively streaming; chunked decoding adds latency and CPU load
   that hurt real-time tracking.
4. **Web Speech API in the web view** — not available or not offline in all three web engines; sends
   audio to cloud services in some browsers.
5. **Remote services** — contradict ADR 0002.

## Decision

sherpa-onnx via its official Rust crate, statically linked, with the
`sherpa-onnx-streaming-zipformer-en-20M-2023-02-17` model (int8, ~44 MB, Apache-2.0) bundled. Audio is
captured natively with cpal (web-view `getUserMedia` support is inconsistent on WebKitGTK and
WKWebView), downmixed to mono and passed to sherpa-onnx at the device's sample rate.

The TypeScript `RecognitionProvider` interface (`src/services/recognition/provider.ts`) keeps engines
swappable: `sherpaProvider` (native) and `createFixtureProvider` (recorded streams for tests and the
browser demo).

Measured on recorded LibriSpeech audio: 94–96% word accuracy, ~19× faster than real time on a laptop.
Streaming models lose the first ~0.5 s of audio after (re)starting, so sessions and each utterance
reset are primed with one second of silence.

## Remote providers

None are implemented. If one is added it must: be opt-in and never the default; show, before each
session, that audio leaves the device and to whom; keep credentials in the OS keychain, never in source,
settings files or logs; and be documented in `docs/PRIVACY.md`.

## Consequences

- The Windows build links the static CRT (`+crt-static`) because the sherpa-onnx static libraries use
  `/MT`.
- The build script downloads prebuilt libraries from GitHub over HTTPS without its own checksum
  check; `SHERPA_ONNX_LIB_DIR` lets packagers supply audited copies.
- The bundled model has no `bpe.vocab`, so hotword biasing is unavailable with it; the matcher is
  designed to work without biasing.
- Other languages need users to add a model folder.
