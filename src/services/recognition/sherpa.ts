/** Local sherpa-onnx recognition running in the Rust backend. Audio never leaves the device. */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { RecognitionResult } from "../../core/matcher";
import type {
  InputDevice,
  RecognitionProvider,
  SessionError,
  SessionState,
  SpeechModel,
} from "./provider";

interface StateEvent {
  session: number;
  status: SessionState;
  code: string | null;
  message: string | null;
}

interface LevelEvent {
  session: number;
  rms: number;
  gated: boolean;
}

export const sherpaProvider: RecognitionProvider = {
  id: "sherpa-onnx",
  label: "On-device (sherpa-onnx)",
  local: true,

  listDevices: () => invoke<InputDevice[]>("list_input_devices"),

  listModels: (extraDirs) => invoke<SpeechModel[]>("list_models", { extraDirs }),

  async start(options, callbacks) {
    const mine =
      <T extends { session: number }>(fn: (p: T) => void) =>
      (e: { payload: T }) => {
        if (e.payload.session === options.session) fn(e.payload);
      };
    const unlisten = await Promise.all([
      listen<RecognitionResult>("speech://result", mine(callbacks.onResult)),
      listen<LevelEvent>(
        "speech://level",
        mine((p) => callbacks.onLevel(p.rms, p.gated)),
      ),
      listen<StateEvent>(
        "speech://state",
        mine((p) => {
          const error: SessionError | undefined =
            p.status === "error"
              ? { code: p.code ?? "unknown", message: p.message ?? "" }
              : undefined;
          callbacks.onState(p.status, error);
        }),
      ),
    ]);
    const cleanup = () => unlisten.forEach((u) => u());
    try {
      await invoke("start_speech", { options });
    } catch (err) {
      cleanup();
      throw err;
    }
    return async () => {
      await invoke("stop_speech");
      cleanup();
    };
  },
};
