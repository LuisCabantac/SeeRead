/**
 * Drives the voice tracker with real recognizer output: the partial-result streams in
 * tests/fixtures/asr were recorded by the Rust test `recognizes_recorded_speech` from
 * public LibriSpeech recordings (see tests/fixtures/README.md).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnnotations } from "../../src/core/annotations";
import { createTracker } from "../../src/core/matcher";
import { DEFAULT_SETTINGS } from "../../src/core/settings";
import { speechTokens } from "../../src/core/tokens";

interface AsrFixture {
  script: string;
  partials: string[];
  final: string;
}

const load = (name: string): AsrFixture =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/asr", `${name}.json`), "utf8"));

const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function wordsOf(script: string) {
  const config = DEFAULT_SETTINGS.annotations;
  return speechTokens(script, parseAnnotations(script, config), true).map((t) => t.word);
}

describe("voice tracking with recorded recognizer output", () => {
  const first = load("0");
  const second = load("1");
  // A realistic script: normal casing and punctuation, with stage directions in between.
  const script = [
    "[Look into the camera.]",
    `${sentenceCase(first.script)}.`,
    "",
    "[Pause. Take a breath.]",
    `${sentenceCase(second.script)}. [Smile.]`,
  ].join("\n");
  const words = wordsOf(script);

  it("follows a full recording to the end of its paragraph without jumping backwards", () => {
    const tracker = createTracker(words);
    let seq = 0;
    const positions: number[] = [];
    for (const text of first.partials) {
      positions.push(tracker.update({ session: 1, seq: ++seq, text, final: false }).position);
    }
    tracker.update({ session: 1, seq: seq + 1, text: first.final, final: true });

    const firstParagraphWords = wordsOf(first.script).length;
    // Recognition misheard the last word ("brothels"), so the tracker may stop one short.
    expect(tracker.state.position).toBeGreaterThanOrEqual(firstParagraphWords - 1);
    expect(tracker.state.position).toBeLessThanOrEqual(firstParagraphWords);
    for (let i = 1; i < positions.length; i++)
      expect(positions[i]!).toBeGreaterThanOrEqual(positions[i - 1]!);
  });

  it("crosses a stage direction into the next paragraph and reaches the end", () => {
    const tracker = createTracker(words);
    let seq = 0;
    for (const fixture of [first, second]) {
      for (const text of fixture.partials)
        tracker.update({ session: 1, seq: ++seq, text, final: false });
      tracker.update({ session: 1, seq: ++seq, text: fixture.final, final: true });
    }
    expect(tracker.state.position).toBeGreaterThanOrEqual(words.length - 1);
    expect(tracker.state.status).toBe("tracking");
  });

  it("keeps up mid-sentence, within a few words of what has been recognized", () => {
    const tracker = createTracker(words);
    let seq = 0;
    for (const text of second.partials) {
      tracker.update({ session: 1, seq: ++seq, text, final: false });
    }
    // The second recording starts after the first paragraph was skipped entirely.
    const expectedEnd = words.length;
    expect(tracker.state.position).toBeGreaterThan(expectedEnd - 6);
  });
});
