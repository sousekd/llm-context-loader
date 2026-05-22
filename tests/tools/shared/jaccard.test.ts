import { describe, expect, it } from "vitest";

import { jaccardSimilarity } from "../../../src/tools/shared/jaccard.js";

describe("jaccardSimilarity", () => {
  it("returns one for two empty sets", () => {
    expect(jaccardSimilarity([], [])).toBe(1);
  });

  it("ignores duplicate values", () => {
    expect(jaccardSimilarity(["a", "a", "b"], ["b", "c"])).toBe(1 / 3);
  });

  it("returns zero for disjoint sets", () => {
    expect(jaccardSimilarity(["a"], ["b"])).toBe(0);
  });
});
