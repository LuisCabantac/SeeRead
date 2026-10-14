import { invoke } from "@tauri-apps/api/core";
import { inTauri } from "./env";

export interface CaptureStatus {
  support: "supported" | "partial" | "unsupported";
  requested: boolean;
  /** What the OS reported after applying; null when it cannot be queried. */
  verified: boolean | null;
  /** Not applied yet because the teleprompter is hidden; applied when it is shown. */
  pending: boolean;
  method: string;
  notes: string;
}

export async function setCaptureExclusion(enabled: boolean): Promise<CaptureStatus> {
  if (!inTauri) {
    return {
      support: "unsupported",
      requested: enabled,
      verified: null,
      pending: false,
      method: "none",
      notes: "Capture exclusion is only available in the desktop app.",
    };
  }
  return invoke<CaptureStatus>("set_capture_exclusion", { enabled });
}
