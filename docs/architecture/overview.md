# Architecture overview

SeeRead is a [Tauri 2](https://tauri.app) application: a Rust process owns native capabilities (windows,
audio, speech recognition, files) and two web views render the UI with React and TypeScript.

```text
┌─────────────────────────── Rust process (src-tauri) ────────────────────────────┐
│ lib.rs        windows from tauri.conf.json, plugins, tray menu, command routing │
│ speech.rs     cpal microphone ─► bounded channel ─► sherpa-onnx worker thread    │
│               emits speech://result | speech://level | speech://state            │
│ storage.rs    atomic writes of scripts and the recovery draft                    │
│ capture_exclusion.rs  OS display-affinity / sharing type + read-back             │
└───────────────▲───────────────────────────────────────────────▲─────────────────┘
                │ commands / events (IPC)                        │
┌───────────────┴────────────── main window ─────┐  ┌───────────┴──── overlay window ─────────┐
│ src/app       shell, playback bar, shortcuts,  │  │ src/overlay  playback engine            │
│               tray actions, overlay control    │──│  usePlayback: auto-scroll rAF loop,     │
│ src/features  editor (CodeMirror), settings,   │ ev│  voice tracker, highlighting, keys     │
│               voice tracking, first run        │  │ features/teleprompter/Prompter          │
└────────────────────────────────────────────────┘  └─────────────────────────────────────────┘
                 both use src/core (pure TypeScript) and src/services (adapters)
```

## Layers

- **`src/core/`** — pure, synchronous TypeScript with no DOM, React or Tauri imports (enforced by
  ESLint). Annotation parsing, tokenization and position mapping, the voice matcher, the auto-scroll
  state machine, overlay placement geometry, the display model, settings schema and validation,
  shortcut handling. This is where most tests live.
- **`src/services/`** — adapters to the outside world. Each one works in Tauri and has a browser
  fallback (localStorage, BroadcastChannel, demo recognizer) so the UI can be developed and E2E-tested
  without the native shell. `recognition/provider.ts` defines the speech-provider interface.
- **`src/features/`, `src/app/`, `src/overlay/`** — React UI.
- **`src-tauri/`** — native code, kept small: only what the web layer cannot do.

## Key flows

**Showing the teleprompter.** The overlay window is declared in `tauri.conf.json` (transparent,
undecorated, always on top, hidden). The main window computes its placement on a connected monitor
(`core/geometry.ts`), shows it, then applies always-on-top, click-through and capture exclusion.
Window state is only changed while the overlay is visible (see ADR 0005).

**Script sync.** The main window owns the script. It sends the text to the overlay on change and when
the overlay announces it is ready. Settings are shared through the Tauri store and change events.

**Automatic scrolling.** `usePlayback` runs a `requestAnimationFrame` loop only while scrolling, calling
the pure `step()` function and setting `scrollTop`. Paragraph positions come from the DOM.

**Voice tracking.** The overlay starts a recognition session with a fresh session id. Rust opens the
microphone, primes and feeds sherpa-onnx, and emits partial and final results. The overlay feeds them
to the tracker (`core/matcher.ts`), which returns a token position; the overlay toggles CSS classes on
the affected word spans and smoothly scrolls the current line to the reading guide.

**Mode switching** converts the reading position between scroll offset and token index via the DOM,
so the reader's place is kept.

## Decisions

Architecture Decision Records live in [`adr/`](adr/):

- [0001 Tauri 2 with React and TypeScript](adr/0001-tauri.md)
- [0002 Local-first, no network at runtime](adr/0002-local-first.md)
- [0003 On-device speech recognition with sherpa-onnx](adr/0003-speech-recognition.md)
- [0004 Confidence-aware voice matching](adr/0004-voice-matching.md)
- [0005 Screen-capture exclusion](adr/0005-capture-exclusion.md)
- [0006 CodeMirror 6 for the script editor](adr/0006-editor.md)

Use [the template](adr/0000-template.md) for new decisions.
