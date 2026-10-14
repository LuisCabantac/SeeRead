/**
 * Automatic scrolling as a pure state machine. The overlay calls `step` from
 * requestAnimationFrame; nothing here touches the DOM, timers or the microphone.
 */

export type ScrollPhase = "stopped" | "delay" | "running" | "paragraph-pause" | "paused" | "ended";

export interface ScrollState {
  phase: ScrollPhase;
  /** Scroll offset in CSS pixels. */
  offset: number;
  /** Current velocity in px/s (ramps toward the configured speed). */
  velocity: number;
  /** Remaining time of a start delay or paragraph pause. */
  timerMs: number;
  /** Index into `layout.breaks` of the next paragraph pause. */
  nextBreak: number;
  /** Phase to return to when resuming from `paused`. */
  resumeTo: "delay" | "running" | "paragraph-pause";
}

export interface ScrollConfig {
  /** Target speed in px/s. */
  speed: number;
  /** Time to accelerate from 0 to `speed`; also used to decelerate into stops. 0 = instant. */
  rampMs: number;
  startDelayMs: number;
  /** Pause at each paragraph break; 0 = never pause. */
  paragraphPauseMs: number;
  endBehavior: "stop" | "loop";
}

export interface ScrollLayout {
  /** Largest reachable offset. */
  maxOffset: number;
  /** Ascending offsets at which a new paragraph reaches the reading guide. */
  breaks: number[];
}

export const MIN_SPEED = 5;
export const MAX_SPEED = 600;
const MAX_FRAME_MS = 100; // a frame after the window slept must not teleport the text
const CRAWL = 4; // px/s floor so deceleration always reaches its stop

export const initialScroll = (): ScrollState => ({
  phase: "stopped",
  offset: 0,
  velocity: 0,
  timerMs: 0,
  nextBreak: 0,
  resumeTo: "running",
});

const firstBreakAfter = (breaks: number[], offset: number) => {
  const i = breaks.findIndex((b) => b > offset + 0.5);
  return i === -1 ? breaks.length : i;
};

export function start(state: ScrollState, config: ScrollConfig, layout: ScrollLayout): ScrollState {
  const offset = state.phase === "ended" ? 0 : state.offset;
  return {
    ...state,
    offset,
    phase: config.startDelayMs > 0 ? "delay" : "running",
    timerMs: config.startDelayMs,
    velocity: 0,
    nextBreak: firstBreakAfter(layout.breaks, offset),
  };
}

export function restart(config: ScrollConfig, layout: ScrollLayout): ScrollState {
  return start(initialScroll(), config, layout);
}

export function pause(state: ScrollState): ScrollState {
  if (state.phase !== "delay" && state.phase !== "running" && state.phase !== "paragraph-pause") {
    return state;
  }
  return { ...state, phase: "paused", velocity: 0, resumeTo: state.phase };
}

export function resume(state: ScrollState): ScrollState {
  return state.phase === "paused" ? { ...state, phase: state.resumeTo } : state;
}

export function stop(state: ScrollState): ScrollState {
  return { ...state, phase: "stopped", velocity: 0, timerMs: 0 };
}

/** Manual override: jump to an offset without changing play/pause state. */
export function seek(state: ScrollState, offset: number, layout: ScrollLayout): ScrollState {
  const clamped = Math.max(0, Math.min(layout.maxOffset, offset));
  const phase = state.phase === "ended" && clamped < layout.maxOffset ? "paused" : state.phase;
  return {
    ...state,
    phase,
    resumeTo: state.phase === "ended" ? "running" : state.resumeTo,
    offset: clamped,
    nextBreak: firstBreakAfter(layout.breaks, clamped),
  };
}

export function step(
  state: ScrollState,
  dtMs: number,
  config: ScrollConfig,
  layout: ScrollLayout,
): ScrollState {
  const dt = Math.min(Math.max(dtMs, 0), MAX_FRAME_MS);

  if (state.phase === "delay" || state.phase === "paragraph-pause") {
    const timerMs = state.timerMs - dt;
    return timerMs > 0 ? { ...state, timerMs } : { ...state, timerMs: 0, phase: "running" };
  }
  if (state.phase !== "running") return state;

  const maxOffset = Math.max(0, layout.maxOffset);
  const pauseBreak = config.paragraphPauseMs > 0 ? layout.breaks[state.nextBreak] : undefined;
  const stopAt = pauseBreak !== undefined ? Math.min(pauseBreak, maxOffset) : maxOffset;
  const target = Math.min(MAX_SPEED, Math.max(MIN_SPEED, config.speed));
  const distance = stopAt - state.offset;

  let velocity = target;
  if (config.rampMs > 0) {
    const accel = target / (config.rampMs / 1000);
    const brake = Math.sqrt(2 * accel * Math.max(distance, 0)); // fastest speed that can still stop
    velocity = Math.max(Math.min(state.velocity + (accel * dt) / 1000, target, brake), CRAWL);
  }

  const offset = state.offset + (velocity * dt) / 1000;
  if (offset < stopAt) return { ...state, offset, velocity };

  if (stopAt < maxOffset) {
    return {
      ...state,
      offset: stopAt,
      velocity: 0,
      phase: "paragraph-pause",
      timerMs: config.paragraphPauseMs,
      nextBreak: state.nextBreak + 1,
    };
  }
  if (config.endBehavior === "loop") return restart(config, layout);
  return { ...state, offset: maxOffset, velocity: 0, phase: "ended" };
}
