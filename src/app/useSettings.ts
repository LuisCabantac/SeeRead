import { useEffect, useState, useSyncExternalStore } from "react";
import type { Settings } from "../core/settings";
import {
  getSettings,
  isLoaded,
  loadSettings,
  subscribeSettings,
  updateSettings,
} from "../services/settings-store";

export function useSettings(): { settings: Settings; loaded: boolean } {
  const settings = useSyncExternalStore(subscribeSettings, getSettings);
  const [loaded, setLoaded] = useState(isLoaded());
  useEffect(() => {
    loadSettings()
      .catch((err) => console.error("Could not load settings", err))
      .finally(() => setLoaded(true));
  }, []);
  return { settings, loaded };
}

/** Immutable update of one settings section. */
export function patchSection<K extends keyof Settings>(
  key: K,
  patch: Partial<Settings[K]> | ((value: Settings[K]) => Partial<Settings[K]>),
): Promise<Settings> {
  return updateSettings((s) => {
    const value = s[key];
    const change = typeof patch === "function" ? patch(value) : patch;
    const merged = typeof value === "object" && value !== null ? { ...value, ...change } : change;
    return { ...s, [key]: merged };
  });
}

export function useTheme(settings: Settings) {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const systemReduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  useEffect(() => {
    const root = document.documentElement;
    const dark = settings.theme === "dark" || (settings.theme === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.contrast = settings.highContrast ? "high" : "normal";
    const reduce =
      settings.reducedMotion === "on" || (settings.reducedMotion === "system" && systemReduce);
    root.dataset.motion = reduce ? "reduce" : "full";
  }, [settings.theme, settings.highContrast, settings.reducedMotion, systemDark, systemReduce]);
}

export function prefersReducedMotion(settings: Settings): boolean {
  return (
    settings.reducedMotion === "on" ||
    (settings.reducedMotion === "system" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
  );
}
