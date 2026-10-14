import { describe, expect, it } from "vitest";
import {
  initialScroll,
  pause,
  restart,
  resume,
  seek,
  start,
  step,
  stop,
  type ScrollConfig,
  type ScrollLayout,
  type ScrollState,
} from "../../src/core/autoscroll";

const config = (over: Partial<ScrollConfig> = {}): ScrollConfig => ({
  speed: 100,
  rampMs: 0,
  startDelayMs: 0,
  paragraphPauseMs: 0,
  endBehavior: "stop",
  ...over,
});
const layout: ScrollLayout = { maxOffset: 1000, breaks: [300, 600] };

function run(state: ScrollState, ms: number, cfg: ScrollConfig, lay = layout, frame = 16) {
  let s = state;
  for (let t = 0; t < ms; t += frame) s = step(s, frame, cfg, lay);
  return s;
}

describe("auto-scroll", () => {
  it("scrolls at constant speed without ramp", () => {
    const cfg = config();
    const s = run(start(initialScroll(), cfg, layout), 1008, cfg);
    expect(s.phase).toBe("running");
    expect(s.offset).toBeCloseTo(100.8, 5);
  });

  it("waits for the start delay before moving", () => {
    const cfg = config({ startDelayMs: 500 });
    let s = start(initialScroll(), cfg, layout);
    expect(s.phase).toBe("delay");
    s = run(s, 480, cfg);
    expect(s.offset).toBe(0);
    s = run(s, 100, cfg);
    expect(s.phase).toBe("running");
  });

  it("accelerates smoothly when a ramp is configured", () => {
    const cfg = config({ rampMs: 1000 });
    let s = start(initialScroll(), cfg, layout);
    s = step(s, 16, cfg, layout);
    expect(s.velocity).toBeLessThan(10);
    s = run(s, 1100, cfg);
    expect(s.velocity).toBeCloseTo(100, 0);
  });

  it("pauses at paragraph breaks and decelerates into them", () => {
    const cfg = config({ paragraphPauseMs: 400, rampMs: 500 });
    let s = start(initialScroll(), cfg, layout);
    let lastVelocity = Infinity;
    while (s.phase === "running") {
      s = step(s, 16, cfg, layout);
      if (s.offset > 290 && s.phase === "running") {
        expect(s.velocity).toBeLessThanOrEqual(lastVelocity + 1e-9);
        lastVelocity = s.velocity;
      }
    }
    expect(s).toMatchObject({ phase: "paragraph-pause", offset: 300, nextBreak: 1 });
    s = run(s, 420, cfg);
    expect(s.phase).toBe("running");
  });

  it("ignores paragraph breaks when the pause is zero", () => {
    const cfg = config();
    const s = run(start(initialScroll(), cfg, layout), 4000, cfg);
    expect(s.offset).toBeGreaterThan(300);
  });

  it("stops at the end", () => {
    const cfg = config({ speed: 600 });
    const s = run(start(initialScroll(), cfg, layout), 3000, cfg);
    expect(s).toMatchObject({ phase: "ended", offset: 1000, velocity: 0 });
  });

  it("loops back to the top when configured", () => {
    const cfg = config({ speed: 600, endBehavior: "loop", startDelayMs: 1000 });
    const s = run(start(initialScroll(), cfg, layout), 3000, cfg); // 1 s delay + 1.67 s run + loop delay
    expect(s.phase).toBe("delay");
    expect(s.offset).toBe(0);
  });

  it("pauses and resumes in the same phase", () => {
    const cfg = config({ startDelayMs: 1000 });
    let s = start(initialScroll(), cfg, layout);
    s = pause(s);
    expect(s.phase).toBe("paused");
    expect(run(s, 2000, cfg).phase).toBe("paused");
    expect(resume(s).phase).toBe("delay");
  });

  it("supports immediate manual override", () => {
    const cfg = config();
    let s = run(start(initialScroll(), cfg, layout), 500, cfg);
    s = seek(s, 650, layout);
    expect(s).toMatchObject({ offset: 650, phase: "running", nextBreak: 2 });
    expect(seek(s, -50, layout).offset).toBe(0);
    expect(seek(s, 5000, layout).offset).toBe(1000);
  });

  it("re-arms an ended script when the reader scrolls back", () => {
    const cfg = config({ speed: 600 });
    let s = run(start(initialScroll(), cfg, layout), 3000, cfg);
    s = seek(s, 200, layout);
    expect(s.phase).toBe("paused");
    expect(resume(s).phase).toBe("running");
  });

  it("restarts from the top and stops in place", () => {
    const cfg = config();
    const s = run(start(initialScroll(), cfg, layout), 500, cfg);
    expect(restart(cfg, layout).offset).toBe(0);
    expect(stop(s)).toMatchObject({ phase: "stopped", offset: s.offset });
  });

  it("resumes from the current offset when started again", () => {
    const cfg = config();
    const s = run(start(initialScroll(), cfg, layout), 500, cfg);
    expect(start(stop(s), cfg, layout).offset).toBe(s.offset);
  });

  it("clamps huge frame gaps", () => {
    const cfg = config();
    const s = step(start(initialScroll(), cfg, layout), 60_000, cfg, layout);
    expect(s.offset).toBeCloseTo(10, 5);
  });

  it("applies speed changes on the next frame", () => {
    let cfg = config({ speed: 50 });
    let s = run(start(initialScroll(), cfg, layout), 200, cfg);
    cfg = config({ speed: 200 });
    const before = s.offset;
    s = step(s, 100, cfg, layout);
    expect(s.offset - before).toBeCloseTo(20, 5);
  });
});
