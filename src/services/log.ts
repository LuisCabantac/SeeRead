/** Opt-in debug logs. Rust drops every entry unless the user turned them on. */
import { invoke } from "@tauri-apps/api/core";
import { appLogDir, join } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { inTauri } from "./env";

export const setDebugLogging = (enabled: boolean) => invoke("set_debug_logging", { enabled });

export const revealLogFile = async () =>
  revealItemInDir(await join(await appLogDir(), "seeread.log"));

/** Sends uncaught errors to the debug log. Messages only, never script text. */
export function logUncaughtErrors() {
  if (!inTauri) return;
  addEventListener(
    "error",
    (e) => void error(`uncaught: ${e.message} (${e.filename}:${e.lineno})`),
  );
  addEventListener("unhandledrejection", (e) => void error(`unhandled rejection: ${e.reason}`));
}
