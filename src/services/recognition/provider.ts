/**
 * Speech recognition providers. The tracker only needs streaming text results, so any
 * engine — local or, in future, remote — can be plugged in behind this interface.
 *
 * A remote provider must: require explicit opt-in, disclose that audio leaves the device
 * before every session, keep credentials out of logs and source, and never be the default.
 * See docs/architecture/adr/0003-speech-recognition.md.
 */
import type { RecognitionResult } from "../../core/matcher";

export interface InputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface SpeechModel {
  dir: string;
  name: string;
  bundled: boolean;
  /** Model supports biasing toward script vocabulary. */
  hotwords: boolean;
}

export type SessionState = "loading" | "listening" | "stopped" | "error";

export interface SessionError {
  code: string;
  message: string;
}

export interface SessionOptions {
  session: number;
  deviceId: string | null;
  modelDir: string;
  gain: number;
  noiseGate: number;
  hotwords: string[];
}

export interface SessionCallbacks {
  onResult(result: RecognitionResult): void;
  onLevel(rms: number, gated: boolean): void;
  onState(state: SessionState, error?: SessionError): void;
}

export interface RecognitionProvider {
  readonly id: string;
  readonly label: string;
  /** True when audio never leaves this device. */
  readonly local: boolean;
  listDevices(): Promise<InputDevice[]>;
  listModels(extraDirs: string[]): Promise<SpeechModel[]>;
  /** Starts listening; resolves to a function that stops the session. */
  start(options: SessionOptions, callbacks: SessionCallbacks): Promise<() => Promise<void>>;
}
