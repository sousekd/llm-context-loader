import { describe, expect, it } from "vitest";

import { boundarySimilarity } from "../../../src/tools/code-reconciler/boundary-similarity.js";
import { lengthRatioSimilarity } from "../../../src/tools/code-reconciler/length-ratio-similarity.js";
import { lineLcsSimilarity } from "../../../src/tools/code-reconciler/line-lcs-similarity.js";
import { tokenJaccardSimilarity } from "../../../src/tools/code-reconciler/token-jaccard-similarity.js";

describe("code-block similarity primitives", () => {
  it("computes line LCS similarity", () => {
    expect(lineLcsSimilarity("a\nb\nc\n", "a\nc\n")).toBe(2 / 3);
  });

  it("computes token Jaccard similarity", () => {
    expect(tokenJaccardSimilarity("const x = 1;", "const y = 1;")).toBe(2 / 4);
  });

  it("computes length-ratio similarity", () => {
    expect(lengthRatioSimilarity("abc", "abcdef")).toBe(0.5);
  });

  it("can ignore whitespace for length-ratio similarity", () => {
    expect(lengthRatioSimilarity("a b", "ab", { ignoreWhitespace: true })).toBe(1);
  });

  it("computes boundary similarity", () => {
    expect(boundarySimilarity("start\nmid\nend\n", "start\nother\nend\n")).toBe(1);
    expect(boundarySimilarity("start\nmid\nend\n", "start\nother\nnope\n")).toBe(0.5);
  });

  it("treats two empty inputs as a perfect boundary match and one-sided empty as zero", () => {
    expect(boundarySimilarity("", "")).toBe(1);
    expect(boundarySimilarity("", "start\nend\n")).toBe(0);
    expect(boundarySimilarity("start\nend\n", "")).toBe(0);
  });
});
