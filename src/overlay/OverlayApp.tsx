import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { matchesAccelerator } from "../core/shortcuts";
import { useLatest } from "../app/useLatest";
import { patchSection, useSettings, useTheme } from "../app/useSettings";
import { Prompter, type PrompterHandle } from "../features/teleprompter/Prompter";
import { useScriptModel } from "../features/teleprompter/model";
import { on, send } from "../services/bus";
import { inTauri, isMac } from "../services/env";
import { EVENTS, type OverlayCommand } from "../services/overlay";
import { updateSettings } from "../services/settings-store";
import { usePlayback } from "./usePlayback";

/** Keys that work while the overlay itself has focus. Global shortcuts are separate. */
const LOCAL_KEYS: [string, OverlayCommand | "faster" | "slower"][] = [
  ["Space", { type: "toggle" }],
  ["Home", { type: "restart" }],
  ["Escape", { type: "stop" }],
  ["ArrowRight", { type: "nudge", delta: 1 }],
  ["ArrowLeft", { type: "nudge", delta: -1 }],
  ["PageDown", { type: "nudge", delta: 5 }],
  ["PageUp", { type: "nudge", delta: -5 }],
  ["ArrowUp", "faster"],
  ["ArrowDown", "slower"],
];

export function changeSpeed(direction: 1 | -1) {
  return patchSection("autoScroll", (a) => ({ speed: a.speed + direction * a.speedStep }));
}

export function OverlayApp() {
  const { settings } = useSettings();
  useTheme(settings);
  const [text, setText] = useState("");
  const model = useScriptModel(text, settings.annotations);
  const prompter = useRef<PrompterHandle>(null);
  const { status, command, onWordClick, onWheel } = usePlayback(model, settings, prompter);
  const commandRef = useLatest(command);

  useEffect(() => {
    const subs = [
      on<string>(EVENTS.script, setText),
      on<OverlayCommand>(EVENTS.command, (c) => commandRef.current(c)),
    ];
    void send("main", EVENTS.ready, null);
    return () => subs.forEach((p) => void p.then((unlisten) => unlisten()));
  }, [commandRef]);

  useEffect(() => {
    void send("main", EVENTS.status, status);
  }, [status]);

  // Remember where the reader put the overlay (physical pixels, per monitor).
  useEffect(() => {
    if (!inTauri) return;
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (await win.isFullscreen()) return;
        const [pos, size, monitor] = await Promise.all([
          win.outerPosition(),
          win.outerSize(),
          currentMonitor(),
        ]);
        await updateSettings((s) => ({
          ...s,
          overlay: {
            ...s.overlay,
            monitor: monitor?.name ?? s.overlay.monitor,
            bounds: { x: pos.x, y: pos.y, width: size.width, height: size.height },
          },
        }));
      }, 600);
    };
    const subs = [win.onMoved(save), win.onResized(save)];
    return () => {
      clearTimeout(timer);
      subs.forEach((p) => void p.then((u) => u()));
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const hit = LOCAL_KEYS.find(([code]) => matchesAccelerator(e, code, isMac));
      if (!hit) return;
      e.preventDefault();
      const action = hit[1];
      if (action === "faster") void changeSpeed(1);
      else if (action === "slower") void changeSpeed(-1);
      else commandRef.current(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandRef]);

  const toggleFullscreen = async () => {
    if (!inTauri) return void document.documentElement.requestFullscreen?.();
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  };

  const hide = async () => {
    command({ type: "stop" });
    if (inTauri) await getCurrentWindow().hide();
    else window.close();
  };

  const voice = settings.mode === "voice";
  const hideControls = settings.appearance.hideControlsWhileReading && status.playing;
  const micLive = status.mic === "listening" || status.mic === "loading";

  return (
    <div className={`overlay ${hideControls ? "reading" : ""}`}>
      <div className="overlay-bar" role="toolbar" aria-label="Teleprompter controls">
        <span className="drag" data-tauri-drag-region title="Drag to move" aria-hidden="true">
          ⠿
        </span>
        <button
          onClick={() => command({ type: "toggle" })}
          aria-label={status.playing ? "Pause" : "Start"}
        >
          {status.playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => command({ type: "restart" })}
          aria-label="Restart from the beginning"
        >
          ⟲
        </button>
        <button onClick={() => command({ type: "stop" })} aria-label="Stop">
          ■
        </button>
        <span className="sep" />
        <button
          aria-pressed={!voice}
          onClick={() => void updateSettings((s) => ({ ...s, mode: "auto" }))}
          title="Automatic scrolling"
        >
          Auto
        </button>
        <button
          aria-pressed={voice}
          onClick={() => void updateSettings((s) => ({ ...s, mode: "voice" }))}
          title="Follow my voice"
        >
          Voice
        </button>
        {!voice && (
          <>
            <button onClick={() => void changeSpeed(-1)} aria-label="Slower">
              −
            </button>
            <span className="speed" aria-live="polite">
              {settings.autoScroll.speed}
            </span>
            <button onClick={() => void changeSpeed(1)} aria-label="Faster">
              +
            </button>
          </>
        )}
        {voice && (
          <span className="pill" role="status">
            <span className={`dot ${micLive ? "live" : ""}`} />
            {micLive ? "Mic on" : "Mic off"}
            {status.tracker === "uncertain" && " · unsure — click a word"}
            {status.tracker === "lost" && " · lost — click a word"}
          </span>
        )}
        <span className="spacer" />
        <button onClick={() => void toggleFullscreen()} aria-label="Toggle full screen">
          ⛶
        </button>
        <button
          onClick={() => void patchSection("overlay", { clickThrough: true })}
          aria-label="Make click-through"
          title="Let clicks pass through the teleprompter. Use the global shortcut or tray menu to undo."
        >
          ⇱
        </button>
        <button onClick={() => void hide()} aria-label="Hide teleprompter">
          ✕
        </button>
      </div>
      {status.error && (
        <div className="overlay-error" role="alert">
          {status.error}
        </div>
      )}
      <Prompter
        ref={prompter}
        model={model}
        settings={settings}
        onWordClick={onWordClick}
        onWheel={onWheel}
      >
        {settings.appearance.showCountdown && status.countdown !== null && (
          <div className="countdown" aria-live="assertive">
            {status.countdown}
          </div>
        )}
        {model.paragraphs.length === 0 && (
          <div className="overlay-empty">Paste or open a script in the SeeRead window.</div>
        )}
      </Prompter>
      {inTauri && (
        <div
          className="resize-grip"
          aria-hidden="true"
          onMouseDown={() => void getCurrentWindow().startResizeDragging("SouthEast")}
        />
      )}
    </div>
  );
}
