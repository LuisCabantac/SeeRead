/**
 * Speech tokens: the normalized words the voice tracker expects to hear, each mapped
 * back to the exact character range of the original script it came from.
 */
import type { Segment } from "./annotations";

export interface SpeechToken {
  /** Normalized word (lowercase, no punctuation). */
  word: string;
  /** Original character range `[start, end)`. Expanded numbers share one range. */
  start: number;
  end: number;
}

const WORD_RE = /\d{1,3}(?:,\d{3})+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[&%@+]/gu;
const SYMBOL_WORDS: Record<string, string> = { "&": "and", "%": "percent", "@": "at", "+": "plus" };

/** Normalizes one word for comparison. Recognizer output must go through this too. */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().replace(/['’]/g, "");
}

/** Splits free text (e.g. recognizer output) into normalized words, expanding numbers. */
export function normalizeText(text: string): string[] {
  return [...text.matchAll(WORD_RE)].flatMap((m) => expandWord(m[0]));
}

function expandWord(raw: string): string[] {
  const symbol = SYMBOL_WORDS[raw];
  if (symbol) return [symbol];
  const n = raw.normalize("NFKC").replace(/,/g, "");
  if (/^\d{1,9}$/.test(n)) return numberToWords(Number(n));
  return [normalizeWord(raw)];
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen",
]; // prettier-ignore
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(n: number): string[] {
  if (n < 20) return [ONES[n]!];
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)]!, ONES[n % 10]!] : [TENS[n / 10]!];
  const scales: [number, string][] = [
    [1_000_000, "million"],
    [1_000, "thousand"],
    [100, "hundred"],
  ];
  for (const [size, name] of scales) {
    if (n >= size) {
      const rest = n % size;
      return [...numberToWords(Math.floor(n / size)), name, ...(rest ? numberToWords(rest) : [])];
    }
  }
  return [];
}

/**
 * Speech tokens for a parsed script. Annotation segments are skipped when
 * `ignoreAnnotations` is set, so stage directions never need to be spoken.
 */
export function speechTokens(
  text: string,
  segments: Segment[],
  ignoreAnnotations: boolean,
): SpeechToken[] {
  const tokens: SpeechToken[] = [];
  for (const seg of segments) {
    if (seg.kind === "annotation" && ignoreAnnotations) continue;
    const slice = text.slice(seg.start, seg.end);
    for (const m of slice.matchAll(WORD_RE)) {
      const start = seg.start + m.index;
      const end = start + m[0].length;
      for (const word of expandWord(m[0])) tokens.push({ word, start, end });
    }
  }
  return tokens;
}

/** Index of the first token whose range ends after `offset` (clamped to the last token). */
export function tokenAtOffset(tokens: SpeechToken[], offset: number): number {
  let lo = 0;
  let hi = tokens.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid]!.end <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
