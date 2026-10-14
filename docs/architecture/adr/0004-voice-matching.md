# 0004: Confidence-aware voice matching

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Recognizers revise partial results, mishear words, and scripts repeat phrases. Naively jumping to the
latest recognized word anywhere in the script makes the teleprompter leap between repeated phrases
and lose the reader. Stage directions must never need to be spoken.

## Decision

`src/core/matcher.ts` implements a tracker with these rules:

- **Tokens.** The script is parsed into text/annotation segments (`core/annotations.ts`) and normalized
  into speech tokens (`core/tokens.ts`): NFKC, lowercase, punctuation and apostrophes removed, numbers
  and `& % @ +` expanded to words. Each token keeps its original character range. Stage directions are
  excluded, so they are skipped naturally.
- **Alignment.** Each update aligns the tail (≤16 words) of _recent finalized words + current
  utterance_ against a window around the position (−40/+80 tokens) with local, Smith-Waterman-style
  alignment: exact match +2, fuzzy match +1 (normalized Levenshtein ≥ 0.75 for "balanced", or a prefix
  of the word still being spoken), mismatch and gaps −1, plus a penalty for distance from the expected
  position. Candidates must end on a word from the _current_ utterance; earlier words are context.
- **Hysteresis.** Moves of ≤2 tokens forward need one exact match; up to 8 need a minimum score; larger
  skips and any backward move (re-reading) need several matched words from the current utterance
  (4 for "balanced"). Backward moves of ≤2 tokens are ignored, since they come from revisions of a
  half-spoken word. Silence never moves the position.
- **Ordering.** Results carry a session id and sequence number; stale sessions and out-of-order results
  are dropped.
- **Confidence.** A smoothed share of recent words that matched. Below 0.45 the status is "uncertain"
  (position frozen). After 6 unexplained updates the status is "lost" and the next search covers the
  whole script, requiring one more matched word than a normal skip.
- **Recovery.** The reader can click a word or nudge with the arrow keys; `setPosition` discards the
  speech heard before the correction.
- **Tolerance setting** maps to fuzzy threshold, minimum score and required matches.

## Consequences

- Behaviour is covered by unit tests (ambiguity, repeats, pauses, skips, errors, revisions, ordering,
  lost/recovery) and by integration tests that replay real recognizer output.
- Number reading is cardinal only ("two thousand twenty four"); other readings rely on fuzzy alignment.
- Cost per update is small (≈0.1–0.2 ms for a 10,000-word script); the whole-script search after losing
  track is memoized (≈6 ms). See `docs/development/benchmarks.md`.
