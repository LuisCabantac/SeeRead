# Platform support and verification log

This page records **how** each platform capability was verified. A feature is only marked "tested"
for a platform after it was exercised on that platform — compiling in CI is not enough.

Legend: ✅ Implemented and tested · 🟡 Implemented but not fully validated · 🟠 Partially supported ·
🗓️ Planned · ⛔ Unsupported.

## Windows

Verified 2026-10-14 on Windows 11 Home 10.0.26200 (x64), one display at 125% scaling, using a debug
build (`npm run tauri build -- --debug --no-bundle`) driven through Windows UI Automation, with window
state read through Win32 APIs.

| Capability                                         | Result | How it was checked                                                                                                                                                                                                                  |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay hidden at launch, no stray frames          | ✅     | `IsWindowVisible` false; screen region captured. (Found and fixed a ghost-frame bug, see ADR 0005.)                                                                                                                                 |
| Transparent, undecorated, always-on-top overlay    | ✅     | After _Show teleprompter_: visible, `WS_EX_TOPMOST` set; screenshot shows tinted panel with desktop behind and no title bar                                                                                                         |
| Automatic scrolling start / pause / stop / restart | ✅     | Text scrolled; controls auto-hid while reading; main window showed Scrolling → Paused → Stopped                                                                                                                                     |
| Click-through                                      | ✅     | Toggle set `WS_EX_TRANSPARENT` on the overlay                                                                                                                                                                                       |
| Global shortcuts                                   | ✅     | Synthesized Ctrl+Alt+Shift+L while another window had focus cleared `WS_EX_TRANSPARENT`; no registration failures reported. (Found and fixed a registration race.)                                                                  |
| Screen-capture exclusion                           | ✅     | `GetWindowDisplayAffinity` read back `0x11` (`WDA_EXCLUDEFROMCAPTURE`) when on and `0x0` when off; a GDI screen capture of the overlay area showed only the window behind it while excluded. Not yet tried with OBS, Teams or Zoom. |
| Paste / copy script through the clipboard          | ✅     | Toolbar Paste inserted clipboard text; Copy script round-tripped it with é, ï and — intact                                                                                                                                          |
| Autosave recovery draft                            | ✅     | `%APPDATA%\app.seeread.SeeRead\drafts\current.json` written with the script within ~2 s                                                                                                                                             |
| Stage directions rendering                         | ✅     | Editor highlighting and teleprompter styling visible; skipped by tracking (automated tests)                                                                                                                                         |
| Speech engine (sherpa-onnx)                        | ✅     | `cargo test -- --ignored` on Windows: 94% / 96% word accuracy on two LibriSpeech recordings                                                                                                                                         |
| Voice tracking with a live microphone              | 🟡     | Device list and model detection shown in Settings; live speech not exercised (no audio was captured during verification)                                                                                                            |
| Open / Save dialogs                                | 🟡     | Not driven by automation; the underlying atomic read/write commands are unit-tested                                                                                                                                                 |
| Multiple monitors, DPI changes                     | 🟡     | Only a single 125% display was available; placement logic is unit-tested                                                                                                                                                            |
| Tray menu                                          | 🟡     | Tray icon registered; menu items not exercised                                                                                                                                                                                      |

## macOS

| Capability                   | Status | Notes                                                                                                                        |
| ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Builds and Rust tests        | 🟡     | CI `Rust (macos-latest)` job (Apple silicon runner)                                                                          |
| Transparent overlay          | 🟡     | Requires `macOSPrivateApi` (enabled). Not yet verified by hand.                                                              |
| Microphone permission prompt | 🟡     | `NSMicrophoneUsageDescription` in `Info.plist`; `com.apple.security.device.audio-input` entitlement for the hardened runtime |
| Screen-capture exclusion     | 🟠     | `NSWindow.sharingType = .none` with read-back. Expected to be ignored by ScreenCaptureKit-based tools on macOS 15+.          |
| Everything else              | 🟡     | Same code paths as Windows; awaiting hands-on validation                                                                     |

## Linux

| Capability                        | Status | Notes                                                                                                                                  |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Builds and Rust tests             | 🟡     | CI `Rust (ubuntu-24.04)` job                                                                                                           |
| Speech engine                     | ✅     | CI `speech` job runs the real-audio test on Ubuntu                                                                                     |
| Transparent always-on-top overlay | 🟠     | Depends on the compositor (X11 compositors and most Wayland compositors support transparency; always-on-top may be ignored on Wayland) |
| Overlay position on Wayland       | 🟠     | Wayland compositors place windows and report every position as 0,0; SeeRead detects Wayland and restores only the size                 |
| Click-through                     | 🟠     | Depends on the window manager/compositor                                                                                               |
| Global shortcuts                  | 🟠     | Work on X11/XWayland; native Wayland sessions do not allow apps to grab global shortcuts                                               |
| Screen-capture exclusion          | ⛔     | No mechanism exists on X11 or Wayland. Wayland screen sharing lets the user share one window, which leaves the overlay out             |
| Everything else                   | 🟡     | Awaiting hands-on validation                                                                                                           |

SeeRead treats the session as Wayland when GTK would use it: the first entry of `GDK_BACKEND`, or
else whenever `WAYLAND_DISPLAY` is set. Launching with `GDK_BACKEND=x11` runs SeeRead through
XWayland, where window placement, always-on-top and global shortcuts follow X11 rules.

### KDE Plasma on Wayland

Verified 2026-10-14 on Arch Linux with KDE Plasma 6.7.5 (Wayland session), using `npm run tauri dev`.

| Capability                         | Result | How it was checked                                                                                         |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Wayland detected, limits explained | ✅     | Settings showed the Wayland notes; with `GDK_BACKEND=x11` the display picker returned and the notes didn't |
| Overlay size restored              | ✅     | Resized, hidden and shown again: same size. _Reset size_ restored the default                              |
| Dragging by the ⠿ handle           | ✅     | The compositor moved the window                                                                            |
| Keep above other windows           | 🟠     | Not by SeeRead itself; Alt+F3 → More Actions → Keep Above Others kept it above other windows               |
| Click-through                      | ✅     | Clicks reached the window behind; the tray's _Toggle click-through_ restored control                       |
| Global shortcuts                   | ⛔     | Not available to apps on Wayland; Settings says so                                                         |

## Reproducing the Windows checks

The UI Automation scripts used above are not part of the repository (they depend on the local desktop).
To repeat the checks by hand:

1. `npm run fetch:model && npm run tauri dev`.
2. Show the teleprompter; confirm it has no title bar, the desktop shows through the tint, and it stays
   above other windows.
3. Settings → Teleprompter window → enable Click-through; confirm clicks pass through; press
   Ctrl+Alt+Shift+L in another app; confirm the teleprompter is clickable again.
4. Settings → Privacy & capture → enable exclusion with the teleprompter visible; confirm the status says
   "Applied — the system confirms the setting"; take a screenshot (Win+Shift+S) and confirm the
   teleprompter is missing from it.
5. Paste a script, wait two seconds, quit with unsaved changes, reopen, and accept the recovery prompt.
6. Switch to Voice, press Start, and read aloud: pause, repeat a sentence, skip a paragraph, and read
   over a stage direction.

Please add your results (OS version, hardware, what you checked) in a pull request.
