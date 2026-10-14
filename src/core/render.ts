/**
 * Display model for the teleprompter: paragraphs of runs. Word runs carry the range of
 * speech-token indices they represent so the overlay can highlight them by index.
 */
import type { Segment } from "./annotations";
import type { SpeechToken } from "./tokens";

export interface Run {
  kind: "plain" | "word" | "annotation";
  text: string;
  /** Inclusive token index range, for `word` runs. */
  first?: number;
  last?: number;
  /** Word that sits inside an annotation (only when annotations are matched). */
  inAnnotation?: boolean;
}

export interface Paragraph {
  /** Offset of the paragraph in the original text. */
  start: number;
  runs: Run[];
}

const PARAGRAPH_BREAK = /\n[ \t]*\n\s*/g;

export function buildRenderModel(
  text: string,
  segments: Segment[],
  tokens: SpeechToken[],
  showAnnotations: boolean,
): Paragraph[] {
  const ranges: [number, number][] = [];
  let from = 0;
  for (const m of text.matchAll(PARAGRAPH_BREAK)) {
    ranges.push([from, m.index]);
    from = m.index + m[0].length;
  }
  ranges.push([from, text.length]);

  let ti = 0;
  const paragraphs: Paragraph[] = [];
  for (const [pStart, pEnd] of ranges) {
    const runs: Run[] = [];
    for (const seg of segments) {
      const start = Math.max(seg.start, pStart);
      const end = Math.min(seg.end, pEnd);
      if (start >= end) continue;
      const isAnnotation = seg.kind === "annotation";
      const hasTokens = ti < tokens.length && tokens[ti]!.start < end;

      if (isAnnotation && !showAnnotations) {
        while (ti < tokens.length && tokens[ti]!.start < end) ti++;
        continue;
      }
      if (isAnnotation && !hasTokens) {
        runs.push({ kind: "annotation", text: text.slice(start, end) });
        continue;
      }

      let cursor = start;
      while (ti < tokens.length && tokens[ti]!.start < end) {
        const tok = tokens[ti]!;
        const first = ti;
        while (ti + 1 < tokens.length && tokens[ti + 1]!.start === tok.start) ti++;
        if (tok.start > cursor) {
          runs.push({
            kind: isAnnotation ? "annotation" : "plain",
            text: text.slice(cursor, tok.start),
          });
        }
        runs.push({
          kind: "word",
          text: text.slice(tok.start, tok.end),
          first,
          last: ti,
          ...(isAnnotation ? { inAnnotation: true } : {}),
        });
        cursor = tok.end;
        ti++;
      }
      if (cursor < end) {
        runs.push({ kind: isAnnotation ? "annotation" : "plain", text: text.slice(cursor, end) });
      }
    }
    if (runs.length > 0) paragraphs.push({ start: pStart, runs });
  }
  return paragraphs;
}
