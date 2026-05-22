import { describe, expect, it } from "vitest";

import { longestCommonSubsequenceLength } from "../../../src/tools/shared/lcs.js";

describe("longestCommonSubsequenceLength", () => {
  it("returns zero for empty inputs", () => {
    expect(longestCommonSubsequenceLength([], ["a"])).toBe(0);
  });

  it("returns the longest common subsequence length", () => {
    expect(longestCommonSubsequenceLength(["a", "b", "c", "d"], ["b", "d"])).toBe(2);
  });

  it("supports custom equality", () => {
    expect(longestCommonSubsequenceLength(["A", "b"], ["a", "B"], { equals: (left, right) => left.toLowerCase() === right.toLowerCase() })).toBe(2);
  });
});
