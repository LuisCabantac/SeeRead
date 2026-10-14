import { describe, expect, it } from "vitest";
import { DEFAULT_ANNOTATION_CONFIG, parseAnnotations } from "../../src/core/annotations";
import { createTracker, levenshteinRatio, type Tracker } from "../../src/core/matcher";
import { speechTokens } from "../../src/core/tokens";

function scriptWords(text: string): string[] {
  return speechTokens(text, parseAnnotations(text, DEFAULT_ANNOTATION_CONFIG), true).map(
    (t) => t.word,
  );
}

/** Feeds a phrase the way a streaming recognizer does: one growing partial per word. */
function speak(
  tracker: Tracker,
  phrase: string,
  ctx: { session: number; seq: number },
  final = true,
) {
  const words = phrase.split(/\s+/).filter(Boolean);
  for (let i = 1; i <= words.length; i++) {
    tracker.update({ ...ctx, seq: ctx.seq++, text: words.slice(0, i).join(" "), final: false });
  }
  if (final) tracker.update({ ...ctx, seq: ctx.seq++, text: phrase, final: true });
  return tracker.state;
}

const SCRIPT = `Good morning everyone and thank you for joining us today.
[Pause and smile at the camera.]
This quarter our team shipped three major features to customers.
We also reduced support tickets by a third compared to last year.

Next I want to talk about what comes after this release.
Our roadmap focuses on reliability, accessibility and performance.
Thank you for joining us today.`;

describe("levenshteinRatio", () => {
  it("scores identical, similar and different words", () => {
    expect(levenshteinRatio("tracking", "tracking")).toBe(1);
    expect(levenshteinRatio("color", "colour")).toBeGreaterThan(0.8);
    expect(levenshteinRatio("cat", "dog")).toBe(0);
  });
});

describe("voice tracker", () => {
  const words = scriptWords(SCRIPT);
  const indexAfter = (phrase: string, from = 0) => {
    const target = phrase.toLowerCase().split(" ");
    for (let i = from; i <= words.length - target.length; i++) {
      if (target.every((w, k) => words[i + k] === w)) return i + target.length;
    }
    throw new Error(`phrase not in script: ${phrase}`);
  };

  it("follows straightforward reading word by word", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you", ctx, false);
    expect(tracker.state.position).toBe(indexAfter("good morning everyone and thank you"));
    expect(tracker.state.status).toBe("tracking");
  });

  it("does not expect stage directions to be spoken", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you for joining us today", ctx);
    speak(tracker, "this quarter our team shipped", ctx);
    expect(tracker.state.position).toBe(indexAfter("this quarter our team shipped"));
    expect(words).not.toContain("smile");
  });

  it("never moves during silence or empty results", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone", ctx);
    const before = tracker.state.position;
    for (let i = 0; i < 20; i++)
      tracker.update({ ...ctx, seq: ctx.seq++, text: "", final: i % 5 === 0 });
    expect(tracker.state.position).toBe(before);
  });

  it("tolerates recognition errors", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good mourning every one and thank you four joining us", ctx);
    expect(tracker.state.position).toBe(indexAfter("thank you for joining us"));
  });

  it("stays on the nearest occurrence of a repeated phrase", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    // "thank you for joining us today" appears at the start and at the very end.
    speak(tracker, "good morning everyone and thank you for joining us today", ctx);
    expect(tracker.state.position).toBe(indexAfter("thank you for joining us today"));
  });

  it("ignores a stray common word that appears nearby", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone", ctx);
    const before = tracker.state.position;
    speak(tracker, "um so yeah the", ctx);
    expect(tracker.state.position).toBe(before);
  });

  it("follows a skipped passage once there is enough evidence", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you for joining us today", ctx);
    speak(tracker, "we also reduced support tickets by a third", ctx);
    expect(tracker.state.position).toBe(indexAfter("reduced support tickets by a third"));
  });

  it("does not jump ahead on a single matching word", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone", ctx);
    const before = tracker.state.position;
    speak(tracker, "roadmap", ctx);
    expect(tracker.state.position).toBe(before);
  });

  it("goes back when the reader repeats an earlier sentence", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you for joining us today", ctx);
    speak(tracker, "this quarter our team shipped three major features to customers", ctx);
    speak(tracker, "we also reduced support tickets", ctx);
    speak(tracker, "this quarter our team shipped three", ctx);
    expect(tracker.state.position).toBe(indexAfter("this quarter our team shipped three"));
  });

  it("keeps position when the reader repeats the words just read", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you", ctx);
    const before = tracker.state.position;
    speak(tracker, "and thank you", ctx);
    expect(tracker.state.position).toBe(before);
  });

  it("drops stale and out-of-order results", () => {
    const tracker = createTracker(words);
    tracker.update({ session: 2, seq: 5, text: "good morning everyone and thank", final: false });
    const pos = tracker.state.position;
    tracker.update({
      session: 2,
      seq: 3,
      text: "good morning everyone and thank you for joining",
      final: false,
    });
    tracker.update({
      session: 1,
      seq: 99,
      text: "good morning everyone and thank you for joining",
      final: false,
    });
    expect(tracker.state.position).toBe(pos);
  });

  it("pauses without losing position and resumes cleanly", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone", ctx, false);
    const pos = tracker.state.position;
    tracker.pause();
    speak(tracker, "good morning everyone and thank you for joining", ctx);
    expect(tracker.state).toMatchObject({ position: pos, status: "paused" });
    tracker.resume();
    expect(tracker.state.status).toBe("tracking");
    speak(tracker, "and thank you for", ctx);
    expect(tracker.state.position).toBe(indexAfter("and thank you for"));
  });

  it("accepts manual repositioning and keeps tracking from there", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    tracker.update({ ...ctx, seq: ctx.seq++, text: "", final: false });
    tracker.setPosition(indexAfter("next i want to talk about"));
    speak(tracker, "what comes after this release", ctx);
    expect(tracker.state.position).toBe(indexAfter("what comes after this release"));
  });

  it("becomes uncertain and then lost on unrelated speech, then recovers globally", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone and thank you", ctx);
    speak(tracker, "sorry folks my dog is barking in the other room hold on a moment please", ctx);
    expect(["uncertain", "lost"]).toContain(tracker.state.status);
    for (let i = 0; i < 3; i++) speak(tracker, "okay where was i completely lost my place", ctx);
    expect(tracker.state.status).toBe("lost");
    speak(tracker, "our roadmap focuses on reliability accessibility and performance", ctx);
    expect(tracker.state.position).toBe(indexAfter("accessibility and performance"));
    expect(tracker.state.status).not.toBe("lost");
  });

  it("restarts from the beginning on reset", () => {
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "good morning everyone", ctx);
    expect(tracker.reset()).toEqual({ position: 0, status: "idle", confidence: 0 });
  });

  it("handles numbers spoken as words", () => {
    const numeric = scriptWords("In 2024 we grew 15% across 3 regions.");
    const tracker = createTracker(numeric);
    const ctx = { session: 1, seq: 0 };
    speak(tracker, "in two thousand twenty four we grew fifteen percent across three regions", ctx);
    expect(tracker.state.position).toBe(numeric.length);
  });

  it("stays fast on long scripts", () => {
    const long = Array.from({ length: 10_000 }, (_, i) => `word${i % 500}`);
    const tracker = createTracker(long);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      tracker.update({
        session: 1,
        seq: i,
        text: long.slice(0, (i % 16) + 1).join(" "),
        final: i % 16 === 15,
      });
    }
    expect((performance.now() - t0) / 200).toBeLessThan(5);
  });
});

describe("voice tracker revisions", () => {
  it("does not step back when the recognizer revises a half-spoken word", () => {
    const words = ["quarter", "of", "the", "brothels", "god", "as"];
    const tracker = createTracker(words);
    const ctx = { session: 1, seq: 0 };
    for (const text of ["quarter of the", "quarter of the bro", "quarter of the broffel"]) {
      tracker.update({ ...ctx, seq: ctx.seq++, text, final: false });
    }
    expect(tracker.state.position).toBe(4);
  });
});
