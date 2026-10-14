/**
 * Protocol between the main window and the teleprompter overlay, plus the main-window
 * side of overlay window management (show, hide, place on a monitor).
 */
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  availableMonitors,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { placeOverlay, type MonitorInfo } from "../core/geometry";
import type { TrackerStatus } from "../core/matcher";
import type { ReadingMode, Settings } from "../core/settings";
import { setCaptureExclusion, type CaptureStatus } from "./capture";
import { inTauri } from "./env";

export const EVENTS = {
  /** main → overlay: the script text to display. */
  script: "overlay://script",
  /** main → overlay: playback commands. */
  command: "overlay://command",
  /** overlay → main: playback status for the main window's controls. */
  status: "overlay://status",
  /** overlay → main: overlay loaded and wants the current script. */
  ready: "overlay://ready",
} as const;

export type OverlayCommand =
  | { type: "start" }
  | { type: "toggle" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "stop" }
  | { type: "nudge"; delta: number }
  | { type: "mode"; mode: ReadingMode };

export type MicState = "off" | "loading" | "listening" | "error";

export interface OverlayStatus {
  mode: ReadingMode;
  playing: boolean;
  /** Paused mid-script (as opposed to stopped); Start resumes from the same place either way. */
  paused: boolean;
  countdown: number | null;
  /** Reading position as a fraction of the script, 0..1. */
  progress: number;
  tracker: TrackerStatus | null;
  confidence: number;
  mic: MicState;
  error: string | null;
}

export const IDLE_STATUS: OverlayStatus = {
  mode: "auto",
  playing: false,
  paused: false,
  countdown: null,
  progress: 0,
  tracker: null,
  confidence: 0,
  mic: "off",
  error: null,
};

const overlayWindow = () => WebviewWindow.getByLabel("overlay");

/** Connected monitors, primary first. */
export async function listMonitors(): Promise<MonitorInfo[]> {
  if (!inTauri) return [];
  const [monitors, primary] = await Promise.all([availableMonitors(), primaryMonitor()]);
  const isPrimary = (name: string | null) => primary !== null && name === primary.name;
  monitors.sort((a, b) => Number(isPrimary(b.name)) - Number(isPrimary(a.name)));
  return monitors.map((m) => ({
    name: m.name,
    rect: {
      x: m.workArea.position.x,
      y: m.workArea.position.y,
      width: m.workArea.size.width,
      height: m.workArea.size.height,
    },
    scale: m.scaleFactor,
  }));
}

/** Moves the overlay onto a connected monitor, restoring saved bounds when still valid. */
export async function placeOverlayWindow(settings: Settings): Promise<void> {
  const win = await overlayWindow();
  if (!win) return;
  const { bounds } = placeOverlay(
    await listMonitors(),
    settings.overlay.monitor,
    settings.overlay.bounds,
  );
  await win.setSize(new PhysicalSize(bounds.width, bounds.height));
  await win.setPosition(new PhysicalPosition(bounds.x, bounds.y));
}

/**
 * Applies always-on-top, click-through and capture exclusion. Only touches the OS while
 * the overlay is visible: changing a never-shown window makes Windows paint a ghost frame.
 */
export async function applyOverlayState(settings: Settings): Promise<CaptureStatus> {
  const win = inTauri ? await overlayWindow() : null;
  if (win && (await win.isVisible())) {
    await win.setAlwaysOnTop(settings.overlay.alwaysOnTop);
    await win.setIgnoreCursorEvents(settings.overlay.clickThrough);
  }
  return setCaptureExclusion(settings.overlay.captureExclusion);
}

let browserOverlay: Window | null = null;

export async function showOverlay(settings: Settings): Promise<void> {
  if (!inTauri) {
    if (!browserOverlay || browserOverlay.closed) {
      browserOverlay = window.open("overlay.html", "seeread-overlay", "width=900,height=320");
    }
    browserOverlay?.focus();
    return;
  }
  const win = await overlayWindow();
  if (!win) return;
  if (!(await win.isVisible())) await placeOverlayWindow(settings);
  await win.show();
}

export async function hideOverlay(): Promise<void> {
  if (!inTauri) {
    browserOverlay?.close();
    browserOverlay = null;
    return;
  }
  await (await overlayWindow())?.hide();
}

export async function isOverlayVisible(): Promise<boolean> {
  if (!inTauri) return !!browserOverlay && !browserOverlay.closed;
  return (await (await overlayWindow())?.isVisible()) ?? false;
}

export async function toggleOverlay(settings: Settings): Promise<boolean> {
  if (await isOverlayVisible()) {
    await hideOverlay();
    return false;
  }
  await showOverlay(settings);
  return true;
}
