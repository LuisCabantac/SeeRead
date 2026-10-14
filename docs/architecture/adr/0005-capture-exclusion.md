# 0005: Screen-capture exclusion through documented OS APIs with read-back

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Presenters often want the teleprompter visible to them but not in a recording or screen share. Operating
systems offer some documented mechanisms with different strengths; none is a guarantee. The feature
must be honest about what it does and must never use stealth or undocumented techniques.

## Decision

- Use Tauri's `set_content_protected`, which calls the documented API on each platform:
  - **Windows:** `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` (Windows 10 2004+); older systems
    behave like `WDA_MONITOR` (a black rectangle).
  - **macOS:** `NSWindow.sharingType = .none`. Recent capture APIs (ScreenCaptureKit, macOS 15+) may
    ignore it, so support is reported as partial.
  - **Linux:** no X11/Wayland mechanism exists; reported as unsupported and nothing is attempted.
- `src-tauri/src/capture_exclusion.rs` then **reads the state back** (`GetWindowDisplayAffinity`,
  `-[NSWindow sharingType]`) and returns `{support, requested, verified, pending, method, notes}`,
  which the Privacy settings page displays verbatim.
- The setting is independent of transparency and other overlay features.
- **Only touch the OS while the overlay is visible.** On Windows, changing display affinity on a
  window that has never been shown made the system paint a ghost of its frame (found during manual
  testing on Windows 11). The main window applies always-on-top, click-through and capture exclusion
  right after showing the overlay; while hidden, the command reports `pending: true`.

## Consequences

- The UI never claims success it cannot observe, and always explains the limitations (cameras, remote
  desktop, privileged capture, compositors, OS updates).
- Verification is manual per platform; results are recorded in `docs/platform-support.md`.
