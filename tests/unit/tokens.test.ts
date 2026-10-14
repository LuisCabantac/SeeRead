import { describe, expect, it } from "vitest";
import { DEFAULT_ANNOTATION_CONFIG, parseAnnotations } from "../../src/core/annotations";
import {
  normalizeText,
  normalizeWord,
  numberToWords,
  speechTokens,
  tokenAtOffset,
} from "../../src/core/tokens";

const tokensOf = (text: string, ignore = true) =>
  speechTokens(text, parseAnnotations(text, DEFAULT_ANNOTATION_CONFIG), ignore);

describe("normalization", () => {
  it("lowercases, strips punctuation and apostrophes", () => {
    expect(normalizeText("Hello, World! Don't STOP—now.")).toEqual([
      "hello",
      "world",
      "dont",
      "stop",
      "now",
    ]);
  });

  it("treats curly and straight apostrophes the same", () => {
    expect(normalizeWord("it’s")).toBe(normalizeWord("it's"));
  });

  it("applies NFKC so compatibility forms match", () => {
    expect(normalizeWord("ﬁne")).toBe("fine");
  });

  it("expands numbers and symbols into spoken words", () => {
    expect(normalizeText("50% & 2,500 people")).toEqual([
      "fifty",
      "percent",
      "and",
      "two",
      "thousand",
      "five",
      "hundred",
      "people",
    ]);
  });

  it("spells cardinals", () => {
    expect(numberToWords(0)).toEqual(["zero"]);
    expect(numberToWords(40)).toEqual(["forty"]);
    expect(numberToWords(1_000_001)).toEqual(["one", "million", "one"]);
    expect(numberToWords(2024)).toEqual(["two", "thousand", "twenty", "four"]);
  });

  it("keeps non-Latin scripts", () => {
    expect(normalizeText("Привет мир")).toEqual(["привет", "мир"]);
  });
});

describe("speechTokens", () => {
  it("excludes stage directions but maps words to original offsets", () => {
    const text = "Welcome. [Pause for two seconds.] Today we begin.";
    const tokens = tokensOf(text);
    expect(tokens.map((t) => t.word)).toEqual(["welcome", "today", "we", "begin"]);
    for (const t of tokens) expect(normalizeWord(text.slice(t.start, t.end))).toBe(t.word);
  });

  it("includes annotation words when not ignored", () => {
    expect(tokensOf("a [b] c", false).map((t) => t.word)).toEqual(["a", "b", "c"]);
  });

  it("maps expanded numbers back to the same source range", () => {
    const text = "We sold 25 units";
    const tokens = tokensOf(text);
    const numberTokens = tokens.filter((t) => text.slice(t.start, t.end) === "25");
    expect(numberTokens.map((t) => t.word)).toEqual(["twenty", "five"]);
  });

  it("finds the token at a character offset", () => {
    const text = "one two three";
    const tokens = tokensOf(text);
    expect(tokenAtOffset(tokens, 0)).toBe(0);
    expect(tokenAtOffset(tokens, 4)).toBe(1);
    expect(tokenAtOffset(tokens, 3)).toBe(1);
    expect(tokenAtOffset(tokens, 999)).toBe(2);
    expect(tokenAtOffset([], 5)).toBe(0);
  });
});
