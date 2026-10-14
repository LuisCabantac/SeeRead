/**
 * Annotation (stage direction) tokenizer.
 *
 * Splits a script into `text` and `annotation` segments without ever mutating the
 * original string: every segment is a `[start, end)` range into the source text, so
 * display, copy/export and speech matching can all be derived from the same parse.
 */

export interface DelimiterPair {
  open: string;
  close: string;
}

export type UnmatchedPolicy = "text" | "toLineEnd" | "toEnd";

export interface AnnotationConfig {
  pairs: DelimiterPair[];
  /** Lines whose first non-blank characters equal this marker are annotations. Empty = off. */
  linePrefix: string;
  allowNesting: boolean;
  /** What an opening delimiter without a closing partner means. */
  unmatched: UnmatchedPolicy;
}

export interface Segment {
  kind: "text" | "annotation";
  start: number;
  end: number;
}

export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  pairs: [{ open: "[", close: "]" }],
  linePrefix: "",
  allowNesting: false,
  unmatched: "text",
};

/** Drops unusable delimiter pairs and sorts longest-open-first so `[[` wins over `[`. */
function usablePairs(pairs: DelimiterPair[]): DelimiterPair[] {
  return pairs
    .filter((p) => p.open.length > 0 && p.close.length > 0)
    .sort((a, b) => b.open.length - a.open.length);
}

function lineEnd(text: string, from: number): number {
  const nl = text.indexOf("\n", from);
  return nl === -1 ? text.length : nl;
}

/** Index just past the closing delimiter, or -1 when there is none. */
function findClose(text: string, from: number, pair: DelimiterPair, nesting: boolean): number {
  if (!nesting || pair.open === pair.close) {
    const at = text.indexOf(pair.close, from);
    return at === -1 ? -1 : at + pair.close.length;
  }
  let depth = 1;
  let i = from;
  while (i < text.length) {
    if (text.startsWith(pair.close, i)) {
      depth -= 1;
      i += pair.close.length;
      if (depth === 0) return i;
    } else if (text.startsWith(pair.open, i)) {
      depth += 1;
      i += pair.open.length;
    } else {
      i += 1;
    }
  }
  return -1;
}

function isLineStart(text: string, i: number): boolean {
  let j = i - 1;
  while (j >= 0 && (text[j] === " " || text[j] === "\t")) j -= 1;
  return j < 0 || text[j] === "\n";
}

export function parseAnnotations(text: string, config: AnnotationConfig): Segment[] {
  const pairs = usablePairs(config.pairs);
  const prefix = config.linePrefix.trim();
  const segments: Segment[] = [];
  // Opening delimiters known to have no closing partner from this offset on (non-nesting only).
  const noCloseFrom = new Map<DelimiterPair, number>();

  const push = (kind: Segment["kind"], start: number, end: number) => {
    if (end <= start) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind && last.end === start && kind === "text") last.end = end;
    else segments.push({ kind, start, end });
  };

  let textStart = 0;
  let i = 0;
  while (i < text.length) {
    if (prefix && text.startsWith(prefix, i) && isLineStart(text, i)) {
      const end = lineEnd(text, i);
      push("text", textStart, i);
      push("annotation", i, end);
      i = textStart = end;
      continue;
    }

    const pair = pairs.find((p) => text.startsWith(p.open, i));
    if (!pair) {
      i += 1;
      continue;
    }

    const bodyStart = i + pair.open.length;
    const known = noCloseFrom.get(pair);
    let end =
      known !== undefined && bodyStart >= known
        ? -1
        : findClose(text, bodyStart, pair, config.allowNesting);
    if (end === -1) {
      if (!config.allowNesting) noCloseFrom.set(pair, Math.min(known ?? Infinity, bodyStart));
      if (config.unmatched === "text") {
        i = bodyStart;
        continue;
      }
      end = config.unmatched === "toLineEnd" ? lineEnd(text, bodyStart) : text.length;
    }
    push("text", textStart, i);
    push("annotation", i, end);
    i = textStart = end;
  }
  push("text", textStart, text.length);
  return segments;
}

/**
 * Removes annotations for copy/export. Collapses the whitespace an inline annotation
 * leaves behind and drops lines that contained nothing but annotations.
 */
export function stripAnnotations(text: string, segments: Segment[]): string {
  let out = "";
  let skipTo = 0;
  for (const s of segments) {
    if (s.kind === "text") {
      out += text.slice(Math.max(s.start, skipTo), s.end);
      continue;
    }
    const eol = lineEnd(text, s.end);
    const ownsLine = /(^|\n)[ \t]*$/.test(out) && text.slice(s.end, eol).trim() === "";
    if (ownsLine) {
      out = out.replace(/[ \t]*$/, "");
      skipTo = eol + 1; // swallow the rest of the line including its newline
    } else if (/[ \t]$/.test(out) && /[ \t]/.test(text[s.end] ?? "")) {
      out = out.replace(/[ \t]+$/, "");
    }
  }
  return out;
}
