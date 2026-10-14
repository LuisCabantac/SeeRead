import { describe, expect, it } from "vitest";
import { DEFAULT_ANNOTATION_CONFIG, parseAnnotations } from "../../src/core/annotations";
import { buildRenderModel } from "../../src/core/render";
import { speechTokens } from "../../src/core/tokens";

function model(text: string, opts: { ignore?: boolean; show?: boolean } = {}) {
  const segments = parseAnnotations(text, DEFAULT_ANNOTATION_CONFIG);
  const tokens = speechTokens(text, segments, opts.ignore ?? true);
  return { paragraphs: buildRenderModel(text, segments, tokens, opts.show ?? true), tokens };
}

describe("buildRenderModel", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const { paragraphs } = model("One\ntwo.\n\n\nThree.");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.runs.map((r) => r.text).join(""))).toEqual([
      "One\ntwo.",
      "Three.",
    ]);
    expect(paragraphs[1]!.start).toBe(11);
  });

  it("reproduces the original text of each paragraph exactly", () => {
    const text = "Hello, world! [Smile.] It's 25% — done.";
    const { paragraphs } = model(text);
    expect(paragraphs[0]!.runs.map((r) => r.text).join("")).toBe(text);
  });

  it("assigns token ranges to word runs, merging expanded numbers", () => {
    const { paragraphs, tokens } = model("We sold 25 units");
    const words = paragraphs[0]!.runs.filter((r) => r.kind === "word");
    expect(words.map((w) => [w.text, w.first, w.last])).toEqual([
      ["We", 0, 0],
      ["sold", 1, 1],
      ["25", 2, 3],
      ["units", 4, 4],
    ]);
    expect(tokens).toHaveLength(5);
  });

  it("renders ignored annotations as a single annotation run", () => {
    const { paragraphs } = model("Hi [wave now] there");
    expect(paragraphs[0]!.runs.map((r) => r.kind)).toEqual([
      "word",
      "plain",
      "annotation",
      "plain",
      "word",
    ]);
  });

  it("renders matched annotations as words flagged inAnnotation", () => {
    const { paragraphs } = model("Hi [wave] there", { ignore: false });
    const wave = paragraphs[0]!.runs.find((r) => r.text === "wave");
    expect(wave).toMatchObject({ kind: "word", inAnnotation: true, first: 1 });
  });

  it("hides annotations when requested and keeps token indices consistent", () => {
    const { paragraphs } = model("Hi [wave] there", { ignore: false, show: false });
    const words = paragraphs[0]!.runs.filter((r) => r.kind === "word");
    expect(words.map((w) => [w.text, w.first])).toEqual([
      ["Hi", 0],
      ["there", 2],
    ]);
  });

  it("splits a multi-paragraph annotation across paragraphs", () => {
    const { paragraphs } = model("A [note\n\nmore] B");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]!.runs.at(-1)).toMatchObject({ kind: "annotation", text: "[note" });
    expect(paragraphs[1]!.runs[0]).toMatchObject({ kind: "annotation", text: "more]" });
  });

  it("returns nothing for empty text", () => {
    expect(model("").paragraphs).toEqual([]);
  });
});
