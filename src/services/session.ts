import { invoke } from "@tauri-apps/api/core";
import { inTauri } from "./env";

/** The display session and what it lets SeeRead do with its windows. */
export interface DisplaySession {
  kind: "windows" | "macos" | "x11" | "wayland" | "unknown";
  /** `XDG_CURRENT_DESKTOP` on Linux, e.g. "KDE" or "GNOME". */
  desktop: string | null;
  /** Windows can be moved to a chosen position (Wayland compositors place windows themselves). */
  windowPositioning: boolean;
  /** The overlay can reliably be kept above other windows. */
  keepAbove: boolean;
  /** Global shortcuts fire while another app has focus. */
  globalShortcuts: boolean;
}

/** Assumed until the backend answers, and in a plain browser. */
export const DEFAULT_SESSION: DisplaySession = {
  kind: "unknown",
  desktop: null,
  windowPositioning: true,
  keepAbove: true,
  globalShortcuts: true,
};

let cached: Promise<DisplaySession> | null = null;

export function displaySession(): Promise<DisplaySession> {
  if (!inTauri) return Promise.resolve(DEFAULT_SESSION);
  cached ??= invoke<DisplaySession>("display_session").catch(() => DEFAULT_SESSION);
  return cached;
}

export const isKde = (s: DisplaySession) => /\bKDE\b/i.test(s.desktop ?? "");
