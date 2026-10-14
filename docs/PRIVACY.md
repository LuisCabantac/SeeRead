# Privacy

SeeRead is designed so that your scripts and your voice never leave your computer.

## Summary

| Data                  | Where it goes                                                               | Retention                                   |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Scripts you save      | Files you choose, as plain UTF-8 text                                       | Until you delete them                       |
| Recovery draft        | `<app data>/drafts/current.json`, only while changes are unsaved            | Deleted when you save, discard or start new |
| Settings, recent list | `<app config>/settings.json`                                                | Until you reset settings or uninstall       |
| Microphone audio      | Processed in memory by the on-device speech engine                          | Discarded immediately; never stored         |
| Recognised words      | Kept in memory only to follow your position                                 | Discarded when tracking stops               |
| Clipboard             | Read/written only when you click Copy, Cut or Paste (or press Ctrl/⌘+C/X/V) | Not stored                                  |

`<app data>` / `<app config>` are the per-user folders for the identifier `app.seeread.SeeRead`:
`%APPDATA%\app.seeread.SeeRead` on Windows, `~/Library/Application Support/app.seeread.SeeRead` on
macOS, and `~/.local/share/app.seeread.SeeRead` / `~/.config/app.seeread.SeeRead` on Linux.

## Network

SeeRead makes **no network connections** while running: no updates check, no analytics, no telemetry,
no crash reporting, no remote fonts. The app's content security policy blocks remote resources. The
only network access happens at **build time** (downloading dependencies and the speech model, verified
by checksum) and is performed by developers and CI, not by the installed app. Links on the About page
open in your browser only when you click them.

There are therefore no network features to disable. If optional network features (such as a remote
speech service) are ever added, they will be off by default, require explicit opt-in, clearly state
what leaves your device, and be listed here.

## Microphone

- The microphone is opened only when you start voice tracking or press **Test microphone**, and closed
  when you press Stop, switch to automatic scrolling, hide the teleprompter, or quit. **Pausing** voice
  tracking keeps the microphone open (the indicator stays on) so you can resume instantly; press Stop
  to release it.
- While it is open, SeeRead shows a red **Mic on** indicator in the main window and teleprompter.
- Your operating system may also show its own microphone indicator and asks for permission the first
  time (macOS shows the reason from SeeRead's `NSMicrophoneUsageDescription`).
- Audio is never written to disk, logged or transmitted.

## Files

SeeRead reads and writes only files you explicitly pick in open/save dialogs (plain `.txt`/`.md`),
plus its own settings and recovery draft. It does not scan folders. Scripts are not encrypted by
SeeRead; protect sensitive scripts with your operating system's disk encryption.

## Logs

Debug logs are **off by default**. When you turn on Settings → General → Write debug logs, SeeRead
writes app events and errors to `seeread.log` in its log folder: `%LOCALAPPDATA%pp.seeread.SeeRead\logs`
on Windows, `~/Library/Logs/app.seeread.SeeRead` on macOS and `~/.local/share/app.seeread.SeeRead/logs`
on Linux. While debug logs are off the file stays empty.

Entries include the SeeRead version and OS, microphone names and formats, speech model folder names,
error messages (which can contain file paths) and crash reports. They never include script text,
transcripts or audio, and nothing is sent anywhere: the file only leaves your computer if you attach it
to a bug report. The log is capped at about 1 MB, with up to two older logs kept; "Show log file" opens
the folder and you can delete it at any time.

Error messages shown in the app never include script text or transcripts.

## Removing your data

Uninstall SeeRead, then delete the `app.seeread.SeeRead` folders listed above. Your script files stay
wherever you saved them.
