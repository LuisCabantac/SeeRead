import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { Select, Slider, Toggle } from "../../components/fields";
import type { Tolerance } from "../../core/matcher";
import type { Settings } from "../../core/settings";
import { patchSection } from "../../app/useSettings";
import { inTauri } from "../../services/env";
import type { InputDevice, SpeechModel } from "../../services/recognition/provider";
import { sherpaProvider } from "../../services/recognition/sherpa";
import { MicTest } from "./MicTest";

export function VoiceSettings({ settings, micBusy }: { settings: Settings; micBusy: boolean }) {
  const v = settings.voice;
  const set = (patch: Partial<Settings["voice"]>) => void patchSection("voice", patch);
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [models, setModels] = useState<SpeechModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((modelDir: string | null) => {
    if (!inTauri) return;
    const fail = (e: { message?: string }) => setError(e?.message ?? String(e));
    sherpaProvider.listDevices().then(setDevices, fail);
    sherpaProvider.listModels(modelDir ? [modelDir] : []).then((m) => {
      setModels(m);
      setError(null);
    }, fail);
  }, []);
  useEffect(() => refresh(v.modelDir), [refresh, v.modelDir]);

  const selected = models.find((m) => m.dir === v.modelDir) ?? models[0];

  const chooseModelFolder = async () => {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Choose a sherpa-onnx streaming model folder",
    });
    if (typeof dir === "string") set({ modelDir: dir });
  };

  return (
    <>
      <h2>Voice tracking</h2>
      <div className="notice">
        <span>
          <strong>Runs on this device.</strong> Audio is processed locally by the sherpa-onnx engine
          and is never recorded, saved or sent anywhere. The microphone is only on while voice
          tracking or a microphone test is running, and SeeRead shows a red “Mic on” indicator
          whenever it is.
        </span>
      </div>
      {!inTauri && (
        <p className="muted">Microphone and model settings are available in the desktop app.</p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <fieldset className="fieldset">
        <legend>Speech model</legend>
        {inTauri && models.length === 0 && (
          <p className="notice warn" role="status">
            No speech model was found. Release builds include an English model. Developers can run{" "}
            <code>npm run fetch:model</code>, or choose a folder containing a sherpa-onnx streaming
            transducer model (encoder, decoder, joiner and tokens.txt). Automatic scrolling works
            without one.
          </p>
        )}
        {models.length > 0 && (
          <Select
            label="Model"
            value={
              v.modelDir && models.some((m) => m.dir === v.modelDir) ? v.modelDir : models[0]!.dir
            }
            options={models.map((m) => [m.dir, `${m.name}${m.bundled ? " (included)" : ""}`])}
            onChange={(dir) => set({ modelDir: dir })}
            hint="The model determines the recognition language."
          />
        )}
        {inTauri && (
          <div className="row">
            <button onClick={() => void chooseModelFolder()}>Add model folder…</button>
            {v.modelDir && (
              <button onClick={() => set({ modelDir: null })}>Use included model</button>
            )}
          </div>
        )}
        <Toggle
          label="Bias toward script words"
          checked={v.useHotwords && selected?.hotwords !== false}
          disabled={selected?.hotwords === false}
          onChange={(x) => set({ useHotwords: x })}
          hint={
            selected?.hotwords === false
              ? "The selected model does not support vocabulary biasing."
              : "Helps with names and jargon."
          }
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Microphone</legend>
        {inTauri && (
          <div className="row">
            <Select
              label="Input device"
              value={v.device ?? ""}
              options={[
                ["", "System default"],
                ...devices.map((d): [string, string] => [
                  d.id,
                  `${d.name}${d.isDefault ? " (default)" : ""}`,
                ]),
              ]}
              onChange={(id) => set({ device: id || null })}
            />
            <button onClick={() => refresh(v.modelDir)}>Refresh</button>
          </div>
        )}
        <Slider
          label="Input gain"
          value={v.gain}
          min={0.25}
          max={4}
          step={0.25}
          format={(x) => `${x.toFixed(2)}×`}
          onChange={(x) => set({ gain: x })}
          hint="Raise for quiet microphones."
        />
        <Slider
          label="Noise gate"
          value={Math.round(v.noiseGate * 1000)}
          min={0}
          max={100}
          format={(x) => (x === 0 ? "Off" : `${x}`)}
          onChange={(x) => set({ noiseGate: x / 1000 })}
          hint="Ignores sounds quieter than this. Raise it in noisy rooms; lower it if your voice is missed."
        />
        <MicTest settings={settings} disabled={micBusy} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Tracking</legend>
        <Select<Tolerance>
          label="Matching tolerance"
          value={v.tolerance}
          options={[
            ["strict", "Strict — fewer false moves"],
            ["balanced", "Balanced"],
            ["lenient", "Lenient — follows paraphrasing and accents more readily"],
          ]}
          onChange={(x) => set({ tolerance: x })}
        />
        <Slider
          label="Look-ahead"
          value={v.leadWords}
          min={0}
          max={10}
          unit=" words"
          onChange={(x) => set({ leadWords: x })}
          hint="Scrolls this many words ahead of what you have said, so the next line is ready."
        />
        <p className="muted">
          If tracking loses your place, click the word you are reading in the teleprompter, or use{" "}
          <kbd>←</kbd>/<kbd>→</kbd> to nudge it. Pausing keeps your position; Restart goes back to
          the top.
        </p>
      </fieldset>
    </>
  );
}
