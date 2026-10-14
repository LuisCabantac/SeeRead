/**
 * Playback engine for the overlay: automatic scrolling and voice tracking, with
 * switching between them that preserves the reading position.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import * as scroll from "../core/autoscroll";
import { createTracker, type Tracker, type TrackerState } from "../core/matcher";
import type { Settings } from "../core/settings";
import { tokenAtOffset } from "../core/tokens";
import { useLatest } from "../app/useLatest";
import { prefersReducedMotion } from "../app/useSettings";
import type { PrompterHandle } from "../features/teleprompter/Prompter";
import type { ScriptModel } from "../features/teleprompter/model";
import { inTauri } from "../services/env";
import { IDLE_STATUS, type OverlayCommand, type OverlayStatus } from "../services/overlay";
import { createFixtureProvider, utterancesToSteps } from "../services/recognition/fixture";
import type { RecognitionProvider, SessionError } from "../services/recognition/provider";
import { sherpaProvider } from "../services/recognition/sherpa";

const ACTIVE = new Set<scroll.ScrollPhase>(["delay", "running", "paragraph-pause"]);

/** In a plain browser there is no microphone backend: simulate a reader for demos/tests. */
function browserDemoProvider(words: string[], from: number): RecognitionProvider {
  const rest = words.slice(from);
  const utterances: string[] = [];
  for (let i = 0; i < rest.length; i += 8) utterances.push(rest.slice(i, i + 8).join(" "));
  return createFixtureProvider(utterancesToSteps(utterances, 220));
}

const errorMessage = (e: unknown) =>
  typeof e === "object" && e && "message" in e ? String((e as SessionError).message) : String(e);

export function usePlayback(
  model: ScriptModel,
  settings: Settings,
  prompter: RefObject<PrompterHandle | null>,
) {
  const settingsRef = useLatest(settings);
  const modelRef = useLatest(model);
  const [status, setStatus] = useState<OverlayStatus>({ ...IDLE_STATUS, mode: settings.mode });
  const statusRef = useRef(status);
  const update = useCallback((patch: Partial<OverlayStatus>) => {
    statusRef.current = { ...statusRef.current, ...patch };
    setStatus(statusRef.current);
  }, []);

  // ---- automatic scrolling -------------------------------------------------------
  const scrollState = useRef(scroll.initialScroll());
  const layout = useRef<scroll.ScrollLayout>({ maxOffset: 0, breaks: [] });
  const raf = useRef<number | null>(null);
  const lastFrame = useRef(0);
  const lastProgress = useRef(0);

  const scrollConfig = (): scroll.ScrollConfig => {
    const a = settingsRef.current.autoScroll;
    return {
      speed: a.speed,
      rampMs: a.rampMs,
      startDelayMs: a.startDelayMs,
      paragraphPauseMs: a.paragraphPauseMs,
      endBehavior: a.endBehavior,
    };
  };

  const measure = () => {
    layout.current = prompter.current?.layout() ?? { maxOffset: 0, breaks: [] };
    return layout.current;
  };

  const publishScroll = (s: scroll.ScrollState) => {
    update({
      playing: ACTIVE.has(s.phase),
      paused: s.phase === "paused",
      countdown: s.phase === "delay" ? Math.ceil(s.timerMs / 1000) : null,
      progress: layout.current.maxOffset > 0 ? s.offset / layout.current.maxOffset : 0,
    });
  };

  const frame = (now: number) => {
    const dt = lastFrame.current ? now - lastFrame.current : 16;
    lastFrame.current = now;
    const prev = scrollState.current;
    const next = scroll.step(prev, dt, scrollConfig(), layout.current);
    scrollState.current = next;
    prompter.current?.setScroll(next.offset);
    const secondTick = Math.ceil(next.timerMs / 1000) !== Math.ceil(prev.timerMs / 1000);
    if (next.phase !== prev.phase || secondTick || now - lastProgress.current > 250) {
      lastProgress.current = now;
      publishScroll(next);
    }
    // Only animate while moving: an idle overlay uses no CPU.
    raf.current = ACTIVE.has(next.phase) ? requestAnimationFrame(frame) : null;
  };

  const runLoop = () => {
    if (raf.current === null) {
      lastFrame.current = 0;
      raf.current = requestAnimationFrame(frame);
    }
  };

  const stopLoop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const seekTo = (offset: number) => {
    scrollState.current = scroll.seek(scrollState.current, offset, layout.current);
    prompter.current?.setScroll(scrollState.current.offset);
    publishScroll(scrollState.current);
  };

  // ---- voice tracking ------------------------------------------------------------
  const tracker = useRef<Tracker | null>(null);
  const stopMic = useRef<(() => Promise<void>) | null>(null);
  const session = useRef(0);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollTarget = useRef<number | null>(null);
  const anim = useRef<number | null>(null);

  const animateScroll = () => {
    if (anim.current !== null) return;
    let last = 0;
    const tick = (now: number) => {
      const target = scrollTarget.current;
      const p = prompter.current;
      if (target === null || !p) {
        anim.current = null;
        return;
      }
      const dt = last ? now - last : 16;
      last = now;
      const current = p.getScroll();
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        p.setScroll(target);
        anim.current = null;
        return;
      }
      p.setScroll(current + diff * Math.min(1, (dt / 1000) * 8));
      anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
  };

  const followToken = (position: number) => {
    const n = modelRef.current.tokens.length;
    if (n === 0) return;
    const focus = Math.min(n - 1, Math.max(0, position - 1 + settingsRef.current.voice.leadWords));
    const target = prompter.current?.offsetForToken(focus);
    if (target == null) return;
    if (prefersReducedMotion(settingsRef.current)) {
      prompter.current?.setScroll(target);
      return;
    }
    scrollTarget.current = target;
    animateScroll();
  };

  const applyTracker = (state: TrackerState) => {
    prompter.current?.highlight(state.position);
    followToken(state.position);
    const n = modelRef.current.tokens.length;
    update({
      tracker: state.status,
      confidence: state.confidence,
      progress: n ? state.position / n : 0,
    });
  };

  const clearCountdown = () => {
    if (countdown.current !== null) clearInterval(countdown.current);
    countdown.current = null;
  };

  const startVoice = async (fromToken: number) => {
    const s = settingsRef.current;
    const words = modelRef.current.tokens.map((t) => t.word);
    tracker.current = createTracker(words, { tolerance: s.voice.tolerance });
    tracker.current.setPosition(fromToken);
    applyTracker(tracker.current.state);
    const id = ++session.current;
    update({ mic: "loading", playing: true, error: null, countdown: null });
    try {
      const provider = inTauri ? sherpaProvider : browserDemoProvider(words, fromToken);
      const models = await provider.listModels(s.voice.modelDir ? [s.voice.modelDir] : []);
      const speechModel = models.find((m) => m.dir === s.voice.modelDir) ?? models[0];
      if (!speechModel) {
        throw new Error(
          "No speech model is installed. Open Settings → Voice tracking to add one, or use automatic scrolling.",
        );
      }
      const stop = await provider.start(
        {
          session: id,
          deviceId: s.voice.device,
          modelDir: speechModel.dir,
          gain: s.voice.gain,
          noiseGate: s.voice.noiseGate,
          hotwords: s.voice.useHotwords ? [...new Set(words)] : [],
        },
        {
          onResult(result) {
            const t = tracker.current;
            if (id !== session.current || !t) return;
            const before = t.state;
            const after = t.update(result);
            if (after !== before) applyTracker(after);
          },
          onLevel() {},
          onState(state, error) {
            if (id !== session.current) return;
            if (state === "listening") update({ mic: "listening" });
            else if (state === "loading") update({ mic: "loading" });
            else if (state === "error") {
              stopMic.current = null;
              update({
                mic: "error",
                playing: false,
                error: error?.message ?? "Speech recognition stopped.",
              });
            } else update({ mic: "off" });
          },
        },
      );
      if (id !== session.current) await stop();
      else stopMic.current = stop;
    } catch (e) {
      if (id === session.current) update({ mic: "error", playing: false, error: errorMessage(e) });
    }
  };

  const stopVoice = async () => {
    session.current++;
    clearCountdown();
    const stop = stopMic.current;
    stopMic.current = null;
    if (stop) await stop().catch(() => undefined);
    update({ mic: "off", playing: false, paused: false, countdown: null });
  };

  const voiceWithCountdown = (fromToken: number) => {
    const delay = settingsRef.current.autoScroll.startDelayMs;
    if (delay <= 0) return void startVoice(fromToken);
    let remaining = Math.ceil(delay / 1000);
    update({ countdown: remaining, playing: true, error: null });
    clearCountdown();
    countdown.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) update({ countdown: remaining });
      else {
        clearCountdown();
        void startVoice(fromToken);
      }
    }, 1000);
  };

  const voicePosition = () =>
    tracker.current?.state.position ?? prompter.current?.tokenAtGuide() ?? 0;

  // ---- commands ------------------------------------------------------------------
  const command = (cmd: OverlayCommand) => {
    const mode = settingsRef.current.mode;
    switch (cmd.type) {
      case "start":
      case "resume":
        if (mode === "auto") {
          measure();
          scrollState.current =
            scrollState.current.phase === "paused"
              ? scroll.resume(scrollState.current)
              : scroll.start(scrollState.current, scrollConfig(), layout.current);
          publishScroll(scrollState.current);
          runLoop();
        } else if (tracker.current?.state.status === "paused" && stopMic.current) {
          applyTracker(tracker.current.resume());
          update({ playing: true, paused: false });
        } else if (!statusRef.current.playing) {
          voiceWithCountdown(prompter.current?.tokenAtGuide() ?? 0);
        }
        return;
      case "pause":
        if (mode === "auto") {
          scrollState.current = scroll.pause(scrollState.current);
          stopLoop();
          publishScroll(scrollState.current);
        } else if (tracker.current && stopMic.current) {
          applyTracker(tracker.current.pause());
          update({ playing: false, paused: true });
        } else void stopVoice();
        return;
      case "toggle":
        return command({ type: statusRef.current.playing ? "pause" : "start" });
      case "stop":
        stopLoop();
        scrollState.current = scroll.stop(scrollState.current);
        publishScroll(scrollState.current);
        if (mode === "voice" || stopMic.current) void stopVoice();
        return;
      case "restart":
        measure();
        prompter.current?.setScroll(0);
        if (mode === "auto") {
          scrollState.current = scroll.restart(scrollConfig(), layout.current);
          publishScroll(scrollState.current);
          runLoop();
        } else if (tracker.current) {
          tracker.current.reset();
          applyTracker(tracker.current.setPosition(0));
        } else {
          prompter.current?.highlight(0);
          voiceWithCountdown(0);
        }
        return;
      case "nudge": {
        if (mode === "voice" && tracker.current) {
          applyTracker(tracker.current.setPosition(tracker.current.state.position + cmd.delta));
        } else {
          const a = settingsRef.current.appearance;
          measure();
          seekTo(scrollState.current.offset + cmd.delta * a.fontSize * a.lineHeight);
        }
        return;
      }
      case "mode":
        return; // modes change through settings; see the effect below
    }
  };

  // Switching modes keeps the reader's place.
  const previousMode = useRef(settings.mode);
  useEffect(() => {
    const from = previousMode.current;
    const to = settings.mode;
    previousMode.current = to;
    if (from === to) return;
    update({ mode: to, tracker: null });
    const wasPlaying = statusRef.current.playing;
    if (to === "voice") {
      const token = prompter.current?.tokenAtGuide() ?? 0;
      stopLoop();
      scrollState.current = scroll.stop(scrollState.current);
      if (wasPlaying) void startVoice(token);
      else prompter.current?.highlight(token);
    } else {
      const offset = prompter.current?.getScroll() ?? 0;
      void stopVoice().then(() => {
        tracker.current = null;
        prompter.current?.highlight(null);
        measure();
        scrollState.current = scroll.seek(scroll.initialScroll(), offset, layout.current);
        if (wasPlaying) {
          scrollState.current = scroll.start(
            scrollState.current,
            { ...scrollConfig(), startDelayMs: 0 },
            layout.current,
          );
          runLoop();
        }
        publishScroll(scrollState.current);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine refs are stable
  }, [settings.mode]);

  // Keep geometry and the tracker in sync when the script or its appearance changes.
  const previousTokens = useRef(model.tokens);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      measure();
      scrollState.current = scroll.seek(
        scrollState.current,
        scrollState.current.offset,
        layout.current,
      );
    });
    const t = tracker.current;
    if (t && previousTokens.current !== model.tokens) {
      const old = previousTokens.current[t.state.position];
      const position = old ? tokenAtOffset(model.tokens, old.start) : model.tokens.length;
      const next = createTracker(
        model.tokens.map((tok) => tok.word),
        { tolerance: settingsRef.current.voice.tolerance },
      );
      if (t.state.status === "paused") next.pause();
      tracker.current = next;
      applyTracker(next.setPosition(position));
    }
    previousTokens.current = model.tokens;
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine refs are stable
  }, [model, settings.appearance]);

  useEffect(
    () => () => {
      stopLoop();
      if (anim.current !== null) cancelAnimationFrame(anim.current);
      void stopVoice();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  const onWordClick = (token: number) => {
    if (tracker.current) applyTracker(tracker.current.setPosition(token));
    else {
      const offset = prompter.current?.offsetForToken(token);
      if (offset != null) seekTo(offset);
    }
  };

  const onWheel = (deltaY: number) => {
    if (tracker.current) {
      scrollTarget.current = null;
      prompter.current?.setScroll((prompter.current?.getScroll() ?? 0) + deltaY);
    } else {
      measure();
      seekTo(scrollState.current.offset + deltaY);
    }
  };

  return { status, command, onWordClick, onWheel, voicePosition };
}
