import { useState } from "react";
import { displayAccelerator } from "../../core/shortcuts";
import { useDisplaySession } from "../../app/useDisplaySession";
import { useSettings } from "../../app/useSettings";
import { isMac } from "../../services/env";
import { MicTest } from "../voice-tracking/MicTest";

const platform = /Windows/.test(navigator.userAgent) ? "windows" : isMac ? "mac" : "linux";

const CAPTURE_NOTE = {
  windows:
    "On Windows 10 (version 2004) and later, SeeRead can ask Windows to hide the teleprompter from most screen recording and screen sharing.",
  mac: "On macOS, hiding the teleprompter from capture is best effort: many current recording and screen-sharing tools can still see it.",
  linux:
    "On Linux, there is no supported way to hide a window from screen capture, so the teleprompter will appear in recordings.",
};

export function Welcome({ onDone }: { onDone(): void }) {
  const { settings } = useSettings();
  const session = useDisplaySession();
  const [step, setStep] = useState(0);
  const steps = 3;

  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <div className="steps" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className={i <= step ? "done" : ""} />
        ))}
      </div>
      <p className="muted">
        Step {step + 1} of {steps}
      </p>

      {step === 0 && (
        <div className="card">
          <h1 id="welcome-title">Welcome to SeeRead</h1>
          <p>
            SeeRead is a teleprompter that floats over your desktop, so you can read a script while
            recording, presenting or on a video call — and keep looking at the camera.
          </p>
          <ul>
            <li>Paste or write your script, then press Start.</li>
            <li>Scroll automatically at a steady pace, or let SeeRead follow your voice.</li>
            <li>
              Put stage directions in <code>[square brackets]</code>: they stay visible but you
              never need to say them.
            </li>
          </ul>
          <p>
            <strong>Private by design:</strong> no account, no cloud, no tracking. Your scripts and
            voice stay on this computer.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h1 id="welcome-title">Voice tracking</h1>
          <p>
            In Voice mode SeeRead listens through your microphone and scrolls to keep up with you.
            Speech is recognised on this device; audio is never recorded or sent anywhere. The
            microphone is only on while voice tracking runs, and a red “Mic on” indicator shows
            whenever it is.
          </p>
          <p>
            The first time, your system may ask whether SeeRead can use the microphone. You can test
            it now, or skip this — automatic scrolling never needs the microphone.
          </p>
          <MicTest settings={settings} />
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h1 id="welcome-title">The teleprompter window</h1>
          <p>
            The teleprompter is a separate, see-through window that stays on top. Drag it by the ⠿
            handle, resize it from the corner, and adjust its look in Settings.
          </p>
          <p>
            <strong>Click-through</strong> lets clicks pass to the window behind the teleprompter.
            To get control back,{" "}
            {session.globalShortcuts ? (
              <>
                press <kbd>{displayAccelerator(settings.shortcuts.toggleClickThrough, isMac)}</kbd>{" "}
                or use the SeeRead tray menu.
              </>
            ) : (
              "use the SeeRead tray menu."
            )}
          </p>
          <p>
            <strong>Screen capture:</strong> {CAPTURE_NOTE[platform]} No method can stop a camera
            filming your screen. Check a test recording before relying on it.
          </p>
        </div>
      )}

      <div className="row">
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {step < steps - 1 ? (
          <button className="primary" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="primary" onClick={onDone}>
            Start using SeeRead
          </button>
        )}
        {step < steps - 1 && <button onClick={onDone}>Skip introduction</button>}
      </div>
    </main>
  );
}
