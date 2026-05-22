import { describe, expect, it } from "vitest";

import { generateDeterministicUrlCandidates } from "../../../src/tools/url-reconciler/deterministic-repairs.js";

describe("generateDeterministicUrlCandidates", () => {
  it("always includes the original", () => {
    expect(generateDeterministicUrlCandidates("https://example.com/a")[0]).toBe("https://example.com/a");
  });

  it("unescapes JSON slashes", () => {
    expect(generateDeterministicUrlCandidates("https:\/\/example.com\/a")).toContain("https://example.com/a");
  });

  it("strips autolink wrappers", () => {
    expect(generateDeterministicUrlCandidates("<https://example.com/a>")).toContain("https://example.com/a");
  });

  it("strips quote and backtick wrappers", () => {
    expect(generateDeterministicUrlCandidates('"https://example.com/a"')).toContain("https://example.com/a");
    expect(generateDeterministicUrlCandidates("`https://example.com/a`")).toContain("https://example.com/a");
  });

  it("trims trailing prose punctuation", () => {
    expect(generateDeterministicUrlCandidates("https://example.com/a,")).toContain("https://example.com/a");
  });

  it("preserves balanced parentheses", () => {
    expect(generateDeterministicUrlCandidates("https://example.com/wiki/Foo_(bar)")).toContain("https://example.com/wiki/Foo_(bar)");
  });

  it("decodes HTML entities", () => {
    expect(generateDeterministicUrlCandidates("https://example.com/a?x=1&amp;y=2")).toContain("https://example.com/a?x=1&y=2");
  });

  it("unescapes markdown punctuation", () => {
    expect(generateDeterministicUrlCandidates("https://example.com/a\\(b\\)")).toContain("https://example.com/a(b)");
  });

  it("collapses stray whitespace", () => {
    expect(generateDeterministicUrlCandidates(" https://example.com /a ")).toContain("https://example.com/a");
  });

  it("deduplicates output", () => {
    const candidates = generateDeterministicUrlCandidates("<https://example.com/a>");

    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("honors maxDepth=0 by returning only the original input", () => {
    const candidates = generateDeterministicUrlCandidates("<https://example.com/a>", { maxDepth: 0 });

    expect(candidates).toEqual(["<https://example.com/a>"]);
  });

  it("honors maxDepth=1 by applying a single transform layer", () => {
    const candidates = generateDeterministicUrlCandidates("<https://example.com/a>", { maxDepth: 1 });

    expect(candidates).toContain("https://example.com/a");
  });

  it("normalizes non-finite and fractional maxDepth values", () => {
    expect(generateDeterministicUrlCandidates("<https://example.com/a>", { maxDepth: Number.POSITIVE_INFINITY })).toEqual(["<https://example.com/a>"]);
    expect(generateDeterministicUrlCandidates("<https://example.com/a>", { maxDepth: Number.NaN })).toEqual(["<https://example.com/a>"]);
    expect(generateDeterministicUrlCandidates("<https://example.com/a>", { maxDepth: 1.9 })).toContain("https://example.com/a");
  });
});

