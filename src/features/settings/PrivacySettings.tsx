import { Toggle } from "../../components/fields";
import type { Settings } from "../../core/settings";
import { patchSection } from "../../app/useSettings";
import type { CaptureStatus } from "../../services/capture";
import { clearDraft } from "../../services/files";

const SUPPORT_LABEL: Record<CaptureStatus["support"], string> = {
  supported: "Supported on this system",
  partial: "Partially supported on this system",
  unsupported: "Not supported on this system",
};

export function PrivacySettings({
  settings,
  capture,
}: {
  settings: Settings;
  capture: CaptureStatus | null;
}) {
  const enabled = settings.overlay.captureExclusion;
  let result = "Not applied";
  if (capture && capture.requested) {
    if (capture.pending) result = "Will be applied when the teleprompter is shown";
    else if (capture.support === "unsupported")
      result = "Not available — the teleprompter will appear in captures";
    else if (capture.verified === true) result = "Applied — the system confirms the setting";
    else if (capture.verified === false) result = "Failed — the system did not accept the setting";
    else result = "Requested — the system cannot confirm it";
  }

  return (
    <>
      <h2>Privacy &amp; capture</h2>

      <fieldset className="fieldset">
        <legend>Hide the teleprompter from screen capture</legend>
        <Toggle
          label="Exclude from screen capture"
          checked={enabled}
          onChange={(v) => void patchSection("overlay", { captureExclusion: v })}
          hint="Asks the operating system to leave the teleprompter out of screenshots, recordings and screen sharing."
        />
        <dl className="field">
          <dt className="label">Status</dt>
          <dd>
            <span role="status">
              {capture ? (
                <>
                  <span className="pill">
                    <span
                      className={`dot ${capture.support === "supported" ? "ok" : capture.support === "partial" ? "warn" : ""}`}
                      aria-hidden="true"
                    />
                    {SUPPORT_LABEL[capture.support]}
                  </span>{" "}
                  {enabled && <strong>{result}</strong>}
                </>
              ) : (
                "Checking…"
              )}
            </span>
          </dd>
          {capture && (
            <>
              <dt className="label">Method</dt>
              <dd>
                <code>{capture.method}</code>
              </dd>
              <dt className="label">Notes</dt>
              <dd>{capture.notes}</dd>
            </>
          )}
        </dl>
        <div className="notice warn">
          <span>
            <strong>This is never a guarantee.</strong> A camera filming your screen, remote-desktop
            sessions, some recording tools, browser-based screen sharing and operating-system
            updates can all still capture the teleprompter. Always check a test recording before
            relying on it.
          </span>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Your data</legend>
        <ul>
          <li>
            Scripts stay on this computer, in files you choose. SeeRead has no account and no cloud.
          </li>
          <li>
            While you have unsaved changes, a recovery draft is kept in SeeRead’s app-data folder
            and deleted when you save.
          </li>
          <li>
            The microphone is used only during voice tracking or a microphone test. Audio is
            processed on this device and never stored or transmitted.
          </li>
          <li>The clipboard is only read or written when you click Copy, Cut or Paste.</li>
          <li>SeeRead makes no network connections and collects no analytics or telemetry.</li>
        </ul>
        <div className="row">
          <button onClick={() => void clearDraft()}>Delete recovery draft</button>
        </div>
      </fieldset>
    </>
  );
}
