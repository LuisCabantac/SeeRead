import type { Segment } from "./annotations";

const WORD = /[\p{L}\p{N}]+(?:['’.,-][\p{L}\p{N}]+)*/gu;

export interface ScriptStats {
  /** All words, including stage directions. */
  words: number;
  /** Words outside annotations — what will actually be read aloud. */
  spokenWords: number;
  characters: number;
}

export function scriptStats(text: string, segments: Segment[]): ScriptStats {
  let spokenWords = 0;
  for (const s of segments) {
    if (s.kind === "text") spokenWords += text.slice(s.start, s.end).match(WORD)?.length ?? 0;
  }
  return { words: text.match(WORD)?.length ?? 0, spokenWords, characters: [...text].length };
}

/** Estimated reading time in seconds at `wpm` words per minute. */
export function readingSeconds(spokenWords: number, wpm: number): number {
  return wpm > 0 ? Math.round((spokenWords / wpm) * 60) : 0;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s.toString().padStart(2, "0")} s` : `${s} s`;
}
