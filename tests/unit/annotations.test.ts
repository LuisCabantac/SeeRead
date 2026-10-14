import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANNOTATION_CONFIG as DEFAULTS,
  parseAnnotations,
  stripAnnotations,
  type AnnotationConfig,
} from "../../src/core/annotations";

const cfg = (over: Partial<AnnotationConfig> = {}): AnnotationConfig => ({ ...DEFAULTS, ...over });

/** Renders segments as `text|<annotation>` for compact assertions. */
function show(text: string, config = cfg()): string {
  return parseAnnotations(text, config)
    .map((s) =>
      s.kind === "annotation" ? `<${text.slice(s.start, s.end)}>` : text.slice(s.start, s.end),
    )
    .join("|");
}

describe("parseAnnotations", () => {
  it("splits the default square-bracket stage direction", () => {
    const text = "Welcome to the presentation. [Pause for two seconds and smile.] Today we begin.";
    expect(show(text)).toBe(
      "Welcome to the presentation. |<[Pause for two seconds and smile.]>| Today we begin.",
    );
  });

  it("covers the full text with contiguous, ordered ranges", () => {
    const text = "a [b] c [d]";
    const segs = parseAnnotations(text, cfg());
    expect(segs[0]!.start).toBe(0);
    expect(segs.at(-1)!.end).toBe(text.length);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBe(segs[i - 1]!.end);
  });

  it("handles adjacent annotations", () => {
    expect(show("[one][two] text")).toBe("<[one]>|<[two]>| text");
  });

  it("handles annotations at the very start and end", () => {
    expect(show("[start] middle [end]")).toBe("<[start]>| middle |<[end]>");
  });

  it("handles multiline annotations and preserves line breaks", () => {
    expect(show("Line one\n[Walk to the\nwhiteboard]\nLine two")).toBe(
      "Line one\n|<[Walk to the\nwhiteboard]>|\nLine two",
    );
  });

  it("treats empty annotations as annotations", () => {
    expect(show("a [] b")).toBe("a |<[]>| b");
  });

  it("leaves unmatched opening delimiters as text by default", () => {
    expect(show("Price [approx 5 and more")).toBe("Price [approx 5 and more");
  });

  it("leaves stray closing delimiters as text", () => {
    expect(show("smile] and [nod]")).toBe("smile] and |<[nod]>");
  });

  it("can treat an unmatched opener as running to end of line", () => {
    expect(show("a [note\nb", cfg({ unmatched: "toLineEnd" }))).toBe("a |<[note>|\nb");
  });

  it("can treat an unmatched opener as running to end of script", () => {
    expect(show("a [note\nb", cfg({ unmatched: "toEnd" }))).toBe("a |<[note\nb>");
  });

  it("does not nest by default: first closer wins", () => {
    expect(show("x [a [b] c] y")).toBe("x |<[a [b]>| c] y");
  });

  it("nests when allowed", () => {
    expect(show("x [a [b] c] y", cfg({ allowNesting: true }))).toBe("x |<[a [b] c]>| y");
  });

  it("supports configurable and multiple delimiter pairs", () => {
    const config = cfg({
      pairs: [
        { open: "(", close: ")" },
        { open: "{{", close: "}}" },
        { open: "<", close: ">" },
      ],
    });
    expect(show("Hi (wave) and {{ cue }} then <look> [kept]", config)).toBe(
      "Hi |<(wave)>| and |<{{ cue }}>| then |<<look>>| [kept]",
    );
  });

  it("prefers the longest opening delimiter", () => {
    const config = cfg({
      pairs: [
        { open: "[", close: "]" },
        { open: "[[", close: "]]" },
      ],
    });
    expect(show("a [[x] y]] b", config)).toBe("a |<[[x] y]]>| b");
  });

  it("supports identical open and close delimiters", () => {
    expect(show("say *softly* now", cfg({ pairs: [{ open: "*", close: "*" }] }))).toBe(
      "say |<*softly*>| now",
    );
  });

  it("ignores unusable empty delimiter pairs", () => {
    expect(show("a [b] c", cfg({ pairs: [{ open: "", close: "]" }, ...DEFAULTS.pairs] }))).toBe(
      "a |<[b]>| c",
    );
  });

  it("supports a line-prefix marker for whole-line directions", () => {
    const config = cfg({ linePrefix: ">>" });
    expect(show("Hello\n  >> Look at camera two\nWorld >> not a prefix", config)).toBe(
      "Hello\n  |<>> Look at camera two>|\nWorld >> not a prefix",
    );
  });

  it("is Unicode safe", () => {
    expect(show("Café 😀 [sourire 🙂] naïve 日本語")).toBe("Café 😀 |<[sourire 🙂]>| naïve 日本語");
  });

  it("handles many unmatched openers without pathological slowdown", () => {
    const text = "[".repeat(50_000);
    const t0 = performance.now();
    expect(parseAnnotations(text, cfg())).toEqual([{ kind: "text", start: 0, end: 50_000 }]);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("stripAnnotations", () => {
  const strip = (text: string, config = cfg()) =>
    stripAnnotations(text, parseAnnotations(text, config));

  it("removes inline annotations and collapses the doubled space", () => {
    expect(strip("Welcome. [Pause.] Today we begin.")).toBe("Welcome. Today we begin.");
  });

  it("removes lines that only contained annotations", () => {
    expect(strip("First line\n[Walk left]\nSecond line")).toBe("First line\nSecond line");
  });

  it("keeps genuinely blank lines and paragraphs", () => {
    expect(strip("Para one.\n\nPara two. [smile]")).toBe("Para one.\n\nPara two. ");
  });

  it("returns the text unchanged when there are no annotations", () => {
    const text = "Plain text — with “quotes”, emoji 🎤 and\nline breaks.";
    expect(strip(text)).toBe(text);
  });

  it("removes multiline annotations that occupy whole lines", () => {
    expect(strip("A\n[one\ntwo]\nB")).toBe("A\nB");
  });
});
