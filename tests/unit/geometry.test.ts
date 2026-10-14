import { describe, expect, it } from "vitest";
import { clampToMonitor, placeOverlay, type MonitorInfo } from "../../src/core/geometry";

const primary: MonitorInfo = {
  name: "A",
  rect: { x: 0, y: 0, width: 1920, height: 1040 },
  scale: 1,
};
const hidpi: MonitorInfo = {
  name: "B",
  rect: { x: 1920, y: 0, width: 3840, height: 2100 },
  scale: 2,
};

describe("overlay placement", () => {
  it("defaults to the top centre of the primary monitor", () => {
    const { bounds, monitor } = placeOverlay([primary, hidpi], null, null);
    expect(monitor).toBe(primary);
    expect(bounds).toEqual({ x: 288, y: 62, width: 1344, height: 312 });
  });

  it("uses the preferred monitor when there are no saved bounds", () => {
    const { monitor, bounds } = placeOverlay([primary, hidpi], "B", null);
    expect(monitor).toBe(hidpi);
    expect(bounds.x).toBeGreaterThanOrEqual(1920);
  });

  it("restores saved bounds that are still on a connected monitor", () => {
    const saved = { x: 2000, y: 100, width: 1000, height: 400 };
    expect(placeOverlay([primary, hidpi], null, saved).bounds).toEqual(saved);
  });

  it("falls back when the saved monitor was disconnected", () => {
    const saved = { x: 2000, y: 100, width: 1000, height: 400 };
    const { monitor } = placeOverlay([primary], null, saved);
    expect(monitor).toBe(primary);
  });

  it("moves saved bounds to the preferred monitor after the user picks another display", () => {
    const saved = { x: 100, y: 100, width: 800, height: 300 };
    expect(placeOverlay([primary, hidpi], "B", saved).monitor).toBe(hidpi);
  });

  it("clamps oversized or off-screen bounds into the work area", () => {
    expect(clampToMonitor({ x: -500, y: 900, width: 5000, height: 50 }, primary.rect)).toEqual({
      x: 0,
      y: 900,
      width: 1920,
      height: 120,
    });
  });

  it("copes with no monitor information", () => {
    expect(placeOverlay([], null, null).monitor).toBeNull();
  });
});
