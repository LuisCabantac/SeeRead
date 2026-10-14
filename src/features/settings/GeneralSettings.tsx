import { ask } from "@tauri-apps/plugin-dialog";
import { Select, Slider, Toggle } from "../../components/fields";
import type { Settings, Theme } from "../../core/settings";
import { patchSection } from "../../app/useSettings";
import { inTauri } from "../../services/env";
import { revealLogFile } from "../../services/log";
import { resetSettings, updateSettings } from "../../services/settings-store";

export function GeneralSettings({ settings }: { settings: Settings }) {
  const set = (patch: Partial<Settings>) => void updateSettings((s) => ({ ...s, ...patch }));
  const editor = settings.editor;

  const reset = async () => {
    const message = "Reset all settings to their defaults? Your scripts are not affected.";
    const ok = inTauri
      ? await ask(message, { title: "SeeRead", kind: "warning" })
      : window.confirm(message);
    if (ok) await resetSettings();
  };

  return (
    <>
      <h2>General</h2>
      <fieldset className="fieldset">
        <legend>Display</legend>
        <Select<Theme>
          label="Theme"
          value={settings.theme}
          options={[
            ["system", "Match system"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={(v) => set({ theme: v })}
        />
        <Toggle
          label="High contrast"
          checked={settings.highContrast}
          onChange={(v) => set({ highContrast: v })}
        />
        <Select
          label="Reduce motion"
          value={settings.reducedMotion}
          options={[
            ["system", "Match system"],
            ["on", "On — jump instead of animating"],
            ["off", "Off"],
          ]}
          onChange={(v) => set({ reducedMotion: v })}
          hint="Affects animations and voice-tracking repositioning. Automatic scrolling still moves, since that is its purpose."
        />
      </fieldset>
      <fieldset className="fieldset">
        <legend>Editor</legend>
        <Slider
          label="Reading pace for estimates"
          value={editor.wpm}
          min={80}
          max={250}
          step={5}
          unit=" wpm"
          onChange={(v) => void patchSection("editor", { wpm: v })}
        />
        <Toggle
          label="Autosave recovery drafts"
          checked={editor.autosave}
          onChange={(v) => void patchSection("editor", { autosave: v })}
        />
        <Slider
          label="Recent scripts to remember"
          value={editor.recentLimit}
          min={0}
          max={30}
          onChange={(v) =>
            void updateSettings((s) => ({
              ...s,
              editor: { ...s.editor, recentLimit: v },
              recent: s.recent.slice(0, v),
            }))
          }
        />
        <div className="row">
          <button onClick={() => set({ recent: [] })} disabled={settings.recent.length === 0}>
            Clear recent scripts
          </button>
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Troubleshooting</legend>
        <Toggle
          label="Write debug logs"
          checked={settings.debugLogs}
          onChange={(v) => set({ debugLogs: v })}
          hint="Saves app events and errors to a local file you can attach to a bug report. Never includes script text, transcripts or audio."
        />
        {inTauri && (
          <div className="row">
            <button onClick={() => void revealLogFile().catch(() => undefined)}>
              Show log file
            </button>
          </div>
        )}
      </fieldset>
      <fieldset className="fieldset">
        <legend>Reset</legend>
        <div className="row">
          <button className="danger" onClick={() => void reset()}>
            Reset all settings
          </button>
          <button onClick={() => set({ firstRunComplete: false })}>
            Show the welcome guide again
          </button>
        </div>
      </fieldset>
    </>
  );
}
