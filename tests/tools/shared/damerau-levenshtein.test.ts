import { describe, expect, it } from "vitest";

import { damerauLevenshteinBounded } from "../../../src/tools/shared/damerau-levenshtein.js";

describe("damerauLevenshteinBounded", () => {
  it("returns zero for identical strings", () => {
    expect(damerauLevenshteinBounded("alpha", "alpha", 2)).toBe(0);
  });

  it("counts insertion, deletion, and substitution", () => {
    expect(damerauLevenshteinBounded("cat", "cart", 2)).toBe(1);
    expect(damerauLevenshteinBounded("cart", "cat", 2)).toBe(1);
    expect(damerauLevenshteinBounded("cat", "cut", 2)).toBe(1);
  });

  it("counts adjacent transposition as one", () => {
    expect(damerauLevenshteinBounded("bbc", "bcb", 2)).toBe(1);
  });

  it("handles combined edits", () => {
    expect(damerauLevenshteinBounded("kitten", "sitting", 4)).toBe(3);
  });

  it("returns maxDistance plus one when outside the bound", () => {
    expect(damerauLevenshteinBounded("abcdef", "uvwxyz", 2)).toBe(3);
  });

  it("handles unicode code points", () => {
    expect(damerauLevenshteinBounded("cafe", "cafe", 1)).toBe(0);
    expect(damerauLevenshteinBounded("cafe", "caff", 1)).toBe(1);
  });

  it("handles empty strings", () => {
    expect(damerauLevenshteinBounded("", "abc", 3)).toBe(3);
    expect(damerauLevenshteinBounded("", "abc", 2)).toBe(3);
  });

  it("is symmetric within the bound", () => {
    const left = damerauLevenshteinBounded("example", "exmaple", 2);
    const right = damerauLevenshteinBounded("exmaple", "example", 2);

    expect(left).toBe(right);
  });
});
