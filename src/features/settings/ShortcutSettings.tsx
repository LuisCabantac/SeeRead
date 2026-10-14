import { useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../../core/settings";
import {
  displayAccelerator,
  eventToAccelerator,
  findConflicts,
  isSafeGlobalShortcut,
} from "../../core/shortcuts";
import { patchSection } from "../../app/useSettings";
import { isMac } from "../../services/env";
import type { ShortcutAction } from "../../services/global-shortcuts";

const LABELS: Record<ShortcutAction, string> = {
  playPause: "Start / pause",
  restart: "Restart",
  stop: "Stop",
  speedUp: "Faster",
  speedDown: "Slower",
  toggleClickThrough: "Toggle click-through (regain control)",
  toggleOverlay: "Show / hide teleprompter",
};

const LOCAL: [string, string][] = [
  ["Space", "Start / pause"],
  ["↑ / ↓", "Faster / slower"],
  ["← / →", "Back / forward one word (voice) or line (auto)"],
  ["Page Up / Page Down", "Back / forward five"],
  ["Home", "Restart"],
  ["Esc", "Stop"],
  ["Click a word", "Continue tracking from that word"],
];

export function ShortcutSettings({
  settings,
  failures,
}: {
  settings: Settings;
  failures: ShortcutAction[];
}) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const bindings = settings.shortcuts;
  const conflicts = findConflicts(bindings);

  const record = (action: ShortcutAction) => (e: React.KeyboardEvent) => {
    if (e.key === "Tab") return;
    e.preventDefault();
    if (e.key === "Escape") return setRecording(null);
    const accel = eventToAccelerator(e.nativeEvent, isMac);
    if (!accel) return; // modifiers only so far
    if (!isSafeGlobalShortcut(accel)) {
      setWarning("Global shortcuts need a modifier key (Ctrl, Alt, Shift, ⌘) or a function key.");
      return;
    }
    setWarning(null);
    setRecording(null);
    void patchSection("shortcuts", { [action]: accel });
  };

  return (
    <>
      <h2>Keyboard shortcuts</h2>
      <p className="muted">
        Global shortcuts work even when another app — such as your video call — has focus.
      </p>
      {warning && (
        <p className="notice warn" role="alert">
          {warning}
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="notice error" role="alert">
          These actions share a shortcut:{" "}
          {conflicts.map((c) => c.map((a) => LABELS[a as ShortcutAction]).join(" & ")).join("; ")}.
        </p>
      )}
      <table className="shortcut-table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Global shortcut</th>
            <th scope="col">
              <span className="visually-hidden">Change</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(LABELS) as ShortcutAction[]).map((action) => (
            <tr key={action}>
              <td>{LABELS[action]}</td>
              <td>
                {bindings[action] ? (
                  <kbd>{displayAccelerator(bindings[action], isMac)}</kbd>
                ) : (
                  <span className="muted">None</span>
                )}
                {failures.includes(action) && <span className="muted"> — unavailable</span>}
              </td>
              <td className="row">
                {recording === action ? (
                  <button autoFocus onKeyDown={record(action)} onBlur={() => setRecording(null)}>
                    Press keys… (Esc to cancel)
                  </button>
                ) : (
                  <button
                    onClick={() => setRecording(action)}
                    aria-label={`Change shortcut for ${LABELS[action]}`}
                  >
                    Change
                  </button>
                )}
                <button
                  onClick={() => void patchSection("shortcuts", { [action]: "" })}
                  aria-label={`Clear shortcut for ${LABELS[action]}`}
                >
                  Clear
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button onClick={() => void patchSection("shortcuts", DEFAULT_SETTINGS.shortcuts)}>
          Restore defaults
        </button>
      </div>

      <h3>In the teleprompter window</h3>
      <table className="shortcut-table">
        <tbody>
          {LOCAL.map(([key, action]) => (
            <tr key={key}>
              <td>
                <kbd>{key}</kbd>
              </td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
