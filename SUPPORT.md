# Getting help

- **Questions and ideas:** open a [discussion or issue](https://github.com/clintgalendez/SeeRead/issues)
  using the feature-request template.
- **Bugs:** use the bug-report template. Include your OS and version, SeeRead version (About page),
  steps to reproduce, and expected vs. actual behaviour. Don't attach private scripts. For crashes or
  anything hard to reproduce, turn on Settings → General → Write debug logs, make the problem happen
  again, then attach `seeread.log` (Settings → General → Show log file). It never contains script text,
  transcripts or audio.
- **Security issues:** follow [SECURITY.md](SECURITY.md) — never post them publicly.

## Common problems

**Voice tracking says no model is installed.** Release builds include an English model. In a
development build, run `npm run fetch:model`. You can also add a sherpa-onnx streaming model folder in
Settings → Voice tracking.

**The microphone level stays empty.** Pick the right input device in Settings → Voice tracking and allow
SeeRead to use the microphone: Windows → Settings → Privacy & security → Microphone; macOS → System
Settings → Privacy & Security → Microphone; Linux → check PipeWire/PulseAudio input selection.

**I can't click the teleprompter any more.** Click-through is on. Press the click-through shortcut
(default Ctrl+Alt+Shift+L, ⌘⌥⇧L on macOS), use the SeeRead tray menu, or press "Regain control" in the
main window.

**The teleprompter still appears in my recording.** Capture exclusion is best effort and unsupported on
Linux. See "Hiding the teleprompter from screen capture" in the README.

**Windows warns that the app is unrecognised / macOS says it can't be opened.** Early releases may be
unsigned. On Windows choose "More info → Run anyway"; on macOS right-click the app and choose Open.
Verify the download's checksum or attestation first (see the README).

SeeRead is maintained by volunteers; there is no guaranteed response time.
