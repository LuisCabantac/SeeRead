# Bundled third-party components

Release builds of SeeRead bundle a speech-recognition model in `resources/models/`,
fetched and checksum-verified by `scripts/fetch-model.mjs`:

- **sherpa-onnx-streaming-zipformer-en-20M-2023-02-17** — streaming English
  transducer model from the k2-fsa project, distributed under the Apache License 2.0.
  Source: https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models

The speech engine itself (sherpa-onnx, with ONNX Runtime) is statically linked into the
application binary and is distributed under the Apache License 2.0 (sherpa-onnx) and
the MIT License (ONNX Runtime). The full third-party license inventory ships with each
release as `THIRD_PARTY_LICENSES.md`.
