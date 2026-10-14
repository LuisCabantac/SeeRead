# Test fixtures

## `asr/*.json`

Partial-result streams produced by SeeRead's speech engine (sherpa-onnx with the bundled
`sherpa-onnx-streaming-zipformer-en-20M-2023-02-17` model) for two recordings that ship in that
model's release archive (`test_wavs/0.wav`, `test_wavs/1.wav`).

The recordings come from the [LibriSpeech corpus](https://www.openslr.org/12) (CC BY 4.0), which is
derived from public-domain LibriVox audiobooks; the text is from Nathaniel Hawthorne's _The Scarlet
Letter_ (public domain). Only the recognizer's text output is stored here, not audio.

Each file contains `script` (the reference transcript), `partials` (every distinct partial result, in
order) and `final`. Regenerate with:

```sh
npm run fetch:model
cd src-tauri && SEEREAD_WRITE_FIXTURES=1 cargo test recognizes_recorded_speech -- --ignored
```
