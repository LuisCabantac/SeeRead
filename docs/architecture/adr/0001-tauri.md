# 0001: Use Tauri 2 with React and TypeScript

- **Status:** accepted
- **Date:** 2026-10-14

## Context

SeeRead needs transparent, borderless, always-on-top windows with click-through; per-platform screen
capture exclusion; microphone capture and CPU-heavy speech recognition; good text rendering; testable
UI; small installers; and a stack that open-source contributors can work on.

## Options considered

1. **Tauri 2 (Rust + system web view)** — window flags (transparent, decorations, always-on-top,
   ignore cursor events, content protection) are built in; Rust is a natural home for audio and native
   adapters; small binaries; fine-grained capabilities. Cons: three different web engines
   (WebView2, WKWebView, WebKitGTK); macOS transparency needs the private-API flag (no Mac App Store);
   Linux behaviour depends on the compositor.
2. **Electron** — mature, one Chromium everywhere, `setContentProtection` built in. Cons: large
   installers and memory use; native audio/ML would still need a native module; security surface.
3. **Qt (C++/QML or PySide)** — excellent native windows and text. Cons: smaller contributor pool for
   QML, LGPL/commercial licensing nuances, heavier toolchain, harder UI testing.

## Decision

Tauri 2 with React 19 + TypeScript (Vite). Rust holds audio, speech and OS adapters; everything else is
TypeScript, with core logic kept pure for testing.

## Consequences

- macOS builds enable `macOSPrivateApi` for transparency, ruling out the Mac App Store.
- Each web engine must be considered; E2E tests run in Chromium and native behaviour is checked by
  hand per platform.
- Window-state changes must respect platform quirks (see ADR 0005 for a Windows example).
