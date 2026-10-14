/**
 * User preferences: shape, defaults and validation. Stored settings are untrusted
 * (hand-edited, older versions, corruption), so everything read back is sanitized
 * against the defaults: wrong types fall back, numbers are clamped, enums checked.
 */
import type { AnnotationConfig, DelimiterPair, UnmatchedPolicy } from "./annotations";
import type { Tolerance } from "./matcher";

export type Theme = "system" | "light" | "dark";
export type Align = "left" | "center" | "right" | "justify";
export type HighlightStyle = "background" | "underline" | "color";
export type ReadingMode = "auto" | "voice";

export interface Settings {
  version: 1;
  firstRunComplete: boolean;
  theme: Theme;
  highContrast: boolean;
  debugLogs: boolean;
  reducedMotion: "system" | "on" | "off";
  mode: ReadingMode;
  appearance: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    align: Align;
    textColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    textShadow: boolean;
    showBorder: boolean;
    marginPercent: number;
    showGuide: boolean;
    guidePercent: number;
    mirrorHorizontal: boolean;
    mirrorVertical: boolean;
    highlightStyle: HighlightStyle;
    highlightColor: string;
    upcomingWords: number;
    dimReadText: boolean;
    hideControlsWhileReading: boolean;
    showCountdown: boolean;
  };
  overlay: {
    alwaysOnTop: boolean;
    clickThrough: boolean;
    captureExclusion: boolean;
    monitor: string | null;
    bounds: { x: number; y: number; width: number; height: number } | null;
  };
  autoScroll: {
    speed: number;
    rampMs: number;
    startDelayMs: number;
    paragraphPauseMs: number;
    endBehavior: "stop" | "loop";
    speedStep: number;
  };
  voice: {
    modelDir: string | null;
    device: string | null;
    gain: number;
    noiseGate: number;
    tolerance: Tolerance;
    leadWords: number;
    useHotwords: boolean;
  };
  annotations: AnnotationConfig & {
    visible: boolean;
    ignoreInMatching: boolean;
    includeInCopy: boolean;
    color: string;
    italic: boolean;
  };
  shortcuts: {
    playPause: string;
    restart: string;
    stop: string;
    speedUp: string;
    speedDown: string;
    toggleClickThrough: string;
    toggleOverlay: string;
  };
  editor: {
    wpm: number;
    recentLimit: number;
    autosave: boolean;
  };
  recent: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  firstRunComplete: false,
  theme: "system",
  highContrast: false,
  debugLogs: false,
  reducedMotion: "system",
  mode: "auto",
  appearance: {
    fontFamily: "system-ui, sans-serif",
    fontSize: 44,
    fontWeight: 500,
    lineHeight: 1.5,
    align: "left",
    textColor: "#ffffff",
    backgroundColor: "#000000",
    backgroundOpacity: 0.65,
    textShadow: true,
    showBorder: false,
    marginPercent: 6,
    showGuide: true,
    guidePercent: 30,
    mirrorHorizontal: false,
    mirrorVertical: false,
    highlightStyle: "background",
    highlightColor: "#ffd60a",
    upcomingWords: 4,
    dimReadText: true,
    hideControlsWhileReading: true,
    showCountdown: true,
  },
  overlay: {
    alwaysOnTop: true,
    clickThrough: false,
    captureExclusion: false,
    monitor: null,
    bounds: null,
  },
  autoScroll: {
    speed: 60,
    rampMs: 800,
    startDelayMs: 3000,
    paragraphPauseMs: 0,
    endBehavior: "stop",
    speedStep: 10,
  },
  voice: {
    modelDir: null,
    device: null,
    gain: 1,
    noiseGate: 0.01,
    tolerance: "balanced",
    leadWords: 1,
    useHotwords: true,
  },
  annotations: {
    pairs: [{ open: "[", close: "]" }],
    linePrefix: "",
    allowNesting: false,
    unmatched: "text",
    visible: true,
    ignoreInMatching: true,
    includeInCopy: true,
    color: "#7dd3fc",
    italic: true,
  },
  shortcuts: {
    playPause: "CommandOrControl+Shift+Alt+Space",
    restart: "CommandOrControl+Shift+Alt+R",
    stop: "CommandOrControl+Shift+Alt+S",
    speedUp: "CommandOrControl+Shift+Alt+ArrowUp",
    speedDown: "CommandOrControl+Shift+Alt+ArrowDown",
    toggleClickThrough: "CommandOrControl+Shift+Alt+L",
    toggleOverlay: "CommandOrControl+Shift+Alt+O",
  },
  editor: {
    wpm: 150,
    recentLimit: 10,
    autosave: true,
  },
  recent: [],
};

/** Inclusive numeric ranges, keyed by dotted path. Anything unlisted is only type-checked. */
const RANGES: Record<string, [number, number]> = {
  "appearance.fontSize": [12, 200],
  "appearance.fontWeight": [100, 900],
  "appearance.lineHeight": [1, 3],
  "appearance.backgroundOpacity": [0, 1],
  "appearance.marginPercent": [0, 40],
  "appearance.guidePercent": [5, 95],
  "appearance.upcomingWords": [0, 30],
  "autoScroll.speed": [5, 600],
  "autoScroll.rampMs": [0, 5000],
  "autoScroll.startDelayMs": [0, 30000],
  "autoScroll.paragraphPauseMs": [0, 30000],
  "autoScroll.speedStep": [1, 100],
  "voice.gain": [0.1, 8],
  "voice.noiseGate": [0, 0.5],
  "voice.leadWords": [0, 10],
  "editor.wpm": [60, 400],
  "editor.recentLimit": [0, 50],
};

const ENUMS: Record<string, readonly string[]> = {
  theme: ["system", "light", "dark"],
  reducedMotion: ["system", "on", "off"],
  mode: ["auto", "voice"],
  "appearance.align": ["left", "center", "right", "justify"],
  "appearance.highlightStyle": ["background", "underline", "color"],
  "autoScroll.endBehavior": ["stop", "loop"],
  "voice.tolerance": ["strict", "balanced", "lenient"],
  "annotations.unmatched": ["text", "toLineEnd", "toEnd"] satisfies UnmatchedPolicy[],
};

const NULLABLE = new Set(["overlay.monitor", "overlay.bounds", "voice.modelDir", "voice.device"]);
const COLOR = /^#[0-9a-f]{6}$/i;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function sanitizePairs(value: unknown, fallback: DelimiterPair[]): DelimiterPair[] {
  if (!Array.isArray(value)) return fallback;
  const pairs = value
    .filter(isRecord)
    .filter((p) => typeof p.open === "string" && typeof p.close === "string")
    .map((p) => ({ open: String(p.open).slice(0, 8), close: String(p.close).slice(0, 8) }))
    .filter((p) => p.open.trim() && p.close.trim());
  return pairs.slice(0, 8);
}

function sanitizeBounds(value: unknown): Settings["overlay"]["bounds"] {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  const nums = [x, y, width, height];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    x: x as number,
    y: y as number,
    width: Math.max(200, width as number),
    height: Math.max(120, height as number),
  };
}

function sanitizeNode(value: unknown, fallback: unknown, path: string): unknown {
  if (path === "annotations.pairs") return sanitizePairs(value, fallback as DelimiterPair[]);
  if (path === "overlay.bounds") return sanitizeBounds(value);
  if (path === "recent") {
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, 50) : [];
  }
  if (NULLABLE.has(path)) return typeof value === "string" ? value : null;
  if (isRecord(fallback)) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(
      Object.entries(fallback).map(([k, v]) => [
        k,
        sanitizeNode(source[k], v, path ? `${path}.${k}` : k),
      ]),
    );
  }
  if (typeof value !== typeof fallback) return fallback;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback;
    const range = RANGES[path];
    return range ? Math.min(range[1], Math.max(range[0], value)) : value;
  }
  if (typeof value === "string") {
    const allowed = ENUMS[path];
    if (allowed) return allowed.includes(value) ? value : fallback;
    if (path.endsWith("Color") || path.endsWith(".color"))
      return COLOR.test(value) ? value : fallback;
    return value.slice(0, 200);
  }
  return value;
}

export function sanitizeSettings(raw: unknown): Settings {
  const settings = sanitizeNode(raw, DEFAULT_SETTINGS, "") as Settings;
  settings.version = 1;
  return settings;
}

/** Moves `path` to the front of the recent list, de-duplicated and capped. */
export function addRecent(recent: string[], path: string, limit: number): string[] {
  return [path, ...recent.filter((p) => p !== path)].slice(0, limit);
}
