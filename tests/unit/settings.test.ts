import { describe, expect, it } from "vitest";
import { DEFAULT_ANNOTATION_CONFIG, parseAnnotations } from "../../src/core/annotations";
import { addRecent, DEFAULT_SETTINGS, sanitizeSettings } from "../../src/core/settings";
import { formatDuration, readingSeconds, scriptStats } from "../../src/core/stats";

describe("sanitizeSettings", () => {
  it("returns defaults for garbage", () => {
    for (const raw of [undefined, null, 42, "x", [], { appearance: "nope" }]) {
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("keeps valid values and fills missing ones", () => {
    const s = sanitizeSettings({ theme: "dark", appearance: { fontSize: 60 } });
    expect(s.theme).toBe("dark");
    expect(s.appearance.fontSize).toBe(60);
    expect(s.appearance.lineHeight).toBe(DEFAULT_SETTINGS.appearance.lineHeight);
  });

  it("clamps numbers, rejects bad enums, colors and types", () => {
    const s = sanitizeSettings({
      theme: "neon",
      appearance: { fontSize: 9999, backgroundOpacity: -1, textColor: "red", align: 3 },
      autoScroll: { speed: Number.NaN },
    });
    expect(s.theme).toBe("system");
    expect(s.appearance.fontSize).toBe(200);
    expect(s.appearance.backgroundOpacity).toBe(0);
    expect(s.appearance.textColor).toBe(DEFAULT_SETTINGS.appearance.textColor);
    expect(s.appearance.align).toBe("left");
    expect(s.autoScroll.speed).toBe(DEFAULT_SETTINGS.autoScroll.speed);
  });

  it("validates delimiter pairs and nullable fields", () => {
    const s = sanitizeSettings({
      annotations: { pairs: [{ open: "(", close: ")" }, { open: "", close: "]" }, "x"] },
      overlay: { monitor: 7, bounds: { x: 1, y: 2, width: 10, height: "tall" } },
      voice: { modelDir: "/models/en" },
    });
    expect(s.annotations.pairs).toEqual([{ open: "(", close: ")" }]);
    expect(s.overlay.monitor).toBeNull();
    expect(s.overlay.bounds).toBeNull();
    expect(s.voice.modelDir).toBe("/models/en");
  });

  it("drops unknown keys", () => {
    expect(sanitizeSettings({ evil: true })).not.toHaveProperty("evil");
  });

  it("maintains a de-duplicated, capped recent list", () => {
    expect(addRecent(["a", "b", "c"], "b", 3)).toEqual(["b", "a", "c"]);
    expect(addRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
    expect(addRecent(["a"], "a", 0)).toEqual([]);
  });
});

describe("script stats", () => {
  it("counts spoken words separately from stage directions", () => {
    const text = "Hello there, world. [Smile and wave.] It's 9.30 now.";
    const stats = scriptStats(text, parseAnnotations(text, DEFAULT_ANNOTATION_CONFIG));
    expect(stats).toEqual({ words: 9, spokenWords: 6, characters: text.length });
  });

  it("estimates and formats reading time", () => {
    expect(readingSeconds(300, 150)).toBe(120);
    expect(readingSeconds(10, 0)).toBe(0);
    expect(formatDuration(125)).toBe("2 min 05 s");
    expect(formatDuration(42)).toBe("42 s");
  });
});
