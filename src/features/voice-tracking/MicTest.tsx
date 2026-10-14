/** Lets the user check their microphone and the speech model before reading. */
import { useEffect, useRef, useState } from "react";
import type { Settings } from "../../core/settings";
import { inTauri } from "../../services/env";
import type { SessionError } from "../../services/recognition/provider";
import { sherpaProvider } from "../../services/recognition/sherpa";

const TEST_SESSION_BASE = 1_000_000; // distinct from overlay sessions

export function MicTest({ settings, disabled }: { settings: Settings; disabled?: boolean }) {
  const [state, setState] = useState<"off" | "loading" | "listening" | "error">("off");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<SessionError | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const sessionRef = useRef(TEST_SESSION_BASE);

  const stop = async () => {
    const s = stopRef.current;
    stopRef.current = null;
    sessionRef.current++;
    if (s) await s().catch(() => undefined);
    setState("off");
    setLevel(0);
  };

  useEffect(() => () => void stop(), []);

  const start = async () => {
    setError(null);
    setHeard("");
    setState("loading");
    const session = ++sessionRef.current;
    try {
      const models = await sherpaProvider.listModels(
        settings.voice.modelDir ? [settings.voice.modelDir] : [],
      );
      const model = models.find((m) => m.dir === settings.voice.modelDir) ?? models[0];
      if (!model) throw { code: "model_missing", message: "No speech model is installed." };
      stopRef.current = await sherpaProvider.start(
        {
          session,
          deviceId: settings.voice.device,
          modelDir: model.dir,
          gain: settings.voice.gain,
          noiseGate: settings.voice.noiseGate,
          hotwords: [],
        },
        {
          onResult: (r) => setHeard(r.text.toLowerCase()),
          onLevel: (rms) => setLevel(rms),
          onState: (s, err) => {
            if (s === "error") {
              setError(err ?? { code: "unknown", message: "Unknown error" });
              setState("error");
            } else if (s !== "stopped") setState(s);
          },
        },
      );
    } catch (e) {
      setError(e as SessionError);
      setState("error");
    }
  };

  if (!inTauri)
    return <p className="muted">The microphone test is available in the desktop app.</p>;

  const live = state === "listening" || state === "loading";
  return (
    <div className="fieldset" aria-live="polite">
      <div className="row">
        {live ? (
          <button onClick={() => void stop()}>Stop test</button>
        ) : (
          <button onClick={() => void start()} disabled={disabled}>
            Test microphone
          </button>
        )}
        <span className="pill">
          <span className={`dot ${live ? "live" : ""}`} aria-hidden="true" />
          {state === "loading" ? "Loading model…" : live ? "Mic on" : "Mic off"}
        </span>
        <span
          className="meter"
          role="meter"
          aria-label="Input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, level * 4) * 100)}
        >
          <span style={{ width: `${Math.min(100, level * 400)}%` }} />
        </span>
      </div>
      {disabled && !live && (
        <p className="muted">Stop voice tracking in the teleprompter to run a test.</p>
      )}
      {live && <p>Heard: {heard ? `“${heard}”` : <span className="muted">say something…</span>}</p>}
      {live && level === 0 && state === "listening" && (
        <p className="muted">
          If the level stays empty, check that the right microphone is selected and that SeeRead is
          allowed to use it in your system privacy settings.
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error.message}
        </p>
      )}
    </div>
  );
}
