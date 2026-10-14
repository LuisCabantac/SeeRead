/**
 * Main-window side of the overlay: keeps it supplied with the current script, relays
 * playback commands, mirrors its status, and wires global shortcuts and the tray menu.
 */
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { Settings } from "../core/settings";
import { on, send } from "../services/bus";
import type { CaptureStatus } from "../services/capture";
import { inTauri } from "../services/env";
import { registerGlobalShortcuts, type ShortcutAction } from "../services/global-shortcuts";
import {
  applyOverlayState,
  EVENTS,
  IDLE_STATUS,
  isOverlayVisible,
  showOverlay,
  toggleOverlay,
  type OverlayCommand,
  type OverlayStatus,
} from "../services/overlay";
import { updateSettings } from "../services/settings-store";
import { useLatest } from "./useLatest";
import { patchSection } from "./useSettings";

export function useOverlayLink(text: string, settings: Settings) {
  const [status, setStatus] = useState<OverlayStatus>(IDLE_STATUS);
  const [visible, setVisible] = useState(false);
  const [capture, setCapture] = useState<CaptureStatus | null>(null);
  const [shortcutFailures, setShortcutFailures] = useState<ShortcutAction[]>([]);
  const textRef = useLatest(text);
  const settingsRef = useLatest(settings);

  // Keep the overlay supplied with the latest script.
  useEffect(() => {
    const timer = setTimeout(() => void send("overlay", EVENTS.script, text), 150);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const subs = [
      on<null>(EVENTS.ready, () => void send("overlay", EVENTS.script, textRef.current)),
      on<OverlayStatus>(EVENTS.status, setStatus),
    ];
    return () => subs.forEach((p) => void p.then((u) => u()));
  }, [textRef]);

  const command = useCallback(
    (cmd: OverlayCommand) => void send("overlay", EVENTS.command, cmd),
    [],
  );

  const applyState = useCallback(
    () =>
      applyOverlayState(settingsRef.current).then(setCapture, (e) => setCapture(captureError(e))),
    [settingsRef],
  );

  const show = useCallback(async () => {
    await showOverlay(settingsRef.current);
    setVisible(true);
    await applyState();
  }, [settingsRef, applyState]);

  const toggle = useCallback(async () => {
    if (await isOverlayVisible()) command({ type: "stop" });
    const nowVisible = await toggleOverlay(settingsRef.current);
    setVisible(nowVisible);
    if (nowVisible) await applyState();
  }, [command, settingsRef, applyState]);

  /** Starting playback always brings the overlay up first. */
  const start = useCallback(async () => {
    await show();
    command({ type: "start" });
  }, [show, command]);

  // Poll visibility cheaply so the toggle button reflects hides from the overlay itself.
  useEffect(() => {
    const id = setInterval(() => void isOverlayVisible().then(setVisible), 1000);
    return () => clearInterval(id);
  }, []);

  // Window behaviour follows settings (and is re-applied whenever the overlay is shown).
  const { captureExclusion, alwaysOnTop, clickThrough } = settings.overlay;
  useEffect(() => {
    void applyState();
  }, [captureExclusion, alwaysOnTop, clickThrough, applyState]);

  const toggleClickThrough = useCallback(
    () => patchSection("overlay", (o) => ({ clickThrough: !o.clickThrough })),
    [],
  );

  const handleAction = useCallback(
    (action: ShortcutAction | string) => {
      switch (action) {
        case "playPause":
        case "play-pause":
          if (!status.playing) void start();
          else command({ type: "toggle" });
          return;
        case "restart":
          return command({ type: "restart" });
        case "stop":
          return command({ type: "stop" });
        case "speedUp":
        case "speedDown": {
          const dir = action === "speedUp" ? 1 : -1;
          return void patchSection("autoScroll", (a) => ({ speed: a.speed + dir * a.speedStep }));
        }
        case "toggleClickThrough":
        case "toggle-click-through":
          return void toggleClickThrough();
        case "toggleOverlay":
        case "toggle-overlay":
          return void toggle();
      }
    },
    [status.playing, start, command, toggle, toggleClickThrough],
  );
  const actionRef = useLatest(handleAction);

  // Settings objects are recreated on every change, so key on the bindings' content.
  const shortcutKey = JSON.stringify(settings.shortcuts);
  useEffect(() => {
    const bindings = JSON.parse(shortcutKey) as Settings["shortcuts"];
    registerGlobalShortcuts(bindings, (a) => actionRef.current(a))
      .then(setShortcutFailures)
      .catch(() => setShortcutFailures(Object.keys(bindings) as ShortcutAction[]));
  }, [shortcutKey, actionRef]);

  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<string>("tray://action", (e) => actionRef.current(e.payload));
    return () => void unlisten.then((u) => u());
  }, [actionRef]);

  const setMode = useCallback(
    (mode: Settings["mode"]) => updateSettings((s) => ({ ...s, mode })),
    [],
  );

  return {
    status,
    visible,
    capture,
    shortcutFailures,
    command,
    start,
    toggle,
    show,
    setMode,
    toggleClickThrough,
  };
}

function captureError(e: unknown): CaptureStatus {
  return {
    support: "unsupported",
    requested: true,
    verified: false,
    pending: false,
    method: "error",
    notes: `Could not apply capture exclusion: ${String((e as Error)?.message ?? e)}`,
  };
}

export type OverlayLink = ReturnType<typeof useOverlayLink>;
