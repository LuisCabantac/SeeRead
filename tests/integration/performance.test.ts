/**
 * Performance budgets for the hot paths, measured on a ~10,000-word script. Budgets are
 * generous (CI machines vary); the printed numbers are what docs/development/benchmarks.md
 * records. Run with `npm run bench`.
 */
import { describe, expect, it } from "vitest";
import * as scroll from "../../src/core/autoscroll";
import { DEFAULT_ANNOTATION_CONFIG, parseAnnotations } from "../../src/core/annotations";
import { createTracker } from "../../src/core/matcher";
import { buildRenderModel } from "../../src/core/render";
import { speechTokens } from "../../src/core/tokens";

const SENTENCE = "The quarterly results show steady growth across every region we operate in.";
const paragraph = [SENTENCE, SENTENCE, `${SENTENCE} [Pause.]`, SENTENCE].join(" ");
const script = Array.from({ length: 200 }, () => paragraph).join("\n\n");

function measure(runs: number, fn: (i: number) => void) {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn(i);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
  return { median: p(0.5), p95: p(0.95), max: times.at(-1)! };
}

const fmt = (s: { median: number; p95: number }) =>
  `median ${s.median.toFixed(3)} ms, p95 ${s.p95.toFixed(3)} ms`;

describe("performance on a 10,000-word script", () => {
  const segments = parseAnnotations(script, DEFAULT_ANNOTATION_CONFIG);
  const tokens = speechTokens(script, segments, true);

  it("parses, tokenizes and builds the display model quickly", () => {
    const stats = measure(20, () => {
      const segs = parseAnnotations(script, DEFAULT_ANNOTATION_CONFIG);
      const toks = speechTokens(script, segs, true);
      buildRenderModel(script, segs, toks, true);
    });
    console.log(`full parse of ${tokens.length} tokens: ${fmt(stats)}`);
    expect(stats.median).toBeLessThan(100);
  });

  it("updates the voice tracker well within a frame", () => {
    const tracker = createTracker(tokens.map((t) => t.word));
    const phrase = SENTENCE.toLowerCase().replace(".", "").split(" ");
    let seq = 0;
    const stats = measure(2000, () => {
      const n = (seq % phrase.length) + 1;
      tracker.update({
        session: 1,
        seq: ++seq,
        text: phrase.slice(0, n).join(" "),
        final: n === phrase.length,
      });
    });
    console.log(`tracker update: ${fmt(stats)}`);
    expect(stats.p95).toBeLessThan(5);
  });

  it("recovers a lost position with a whole-script search in bounded time", () => {
    const tracker = createTracker(tokens.map((t) => t.word));
    let seq = 0;
    for (let i = 0; i < 8; i++) {
      tracker.update({
        session: 1,
        seq: ++seq,
        text: "completely unrelated words here",
        final: true,
      });
    }
    expect(tracker.state.status).toBe("lost");
    const stats = measure(50, () => {
      tracker.update({ session: 1, seq: ++seq, text: "nothing that matches at all", final: false });
    });
    console.log(`lost-mode global search: ${fmt(stats)}`);
    expect(stats.p95).toBeLessThan(50);
  });

  it("computes an auto-scroll frame in microseconds", () => {
    const layout = { maxOffset: 500_000, breaks: Array.from({ length: 200 }, (_, k) => k * 2500) };
    const config = {
      speed: 80,
      rampMs: 800,
      startDelayMs: 0,
      paragraphPauseMs: 500,
      endBehavior: "stop" as const,
    };
    let state = scroll.start(scroll.initialScroll(), config, layout);
    const stats = measure(10_000, () => {
      state = scroll.step(state, 16, config, layout);
    });
    console.log(`auto-scroll step: ${fmt(stats)}`);
    expect(stats.p95).toBeLessThan(0.5);
  });
});
