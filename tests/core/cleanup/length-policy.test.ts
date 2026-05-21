import { describe, expect, it } from "vitest";

import { checkEligibility, compactChars, estimateTokens, type StageEligibilityInput } from "../../../src/core/cleanup/length-policy.js";

function makeEligibilityInput(overrides: Partial<StageEligibilityInput> = {}): StageEligibilityInput {
  return {
    enabled: true,
    inputChars: 1000,
    minInputChars: 100,
    maxInputChars: 5000,
    contextTokens: 100_000,
    charsPerToken: 4,
    outputRatio: 0.5,
    ...overrides
  };
}

describe("length-policy", () => {
  it("returns compacted character counts", () => {
    expect(compactChars("  a   b\n\nc  ")).toBe(5);
    expect(compactChars("   \n\n  ")).toBe(0);
  });

  it("returns estimated token counts", () => {
    expect(estimateTokens(10, 4)).toBe(3);
    expect(estimateTokens(8, 4)).toBe(2);
  });

  it("returns character counts when charsPerToken is invalid", () => {
    expect(estimateTokens(10, 0)).toBe(10);
    expect(estimateTokens(10, -1)).toBe(10);
  });

  it("returns skipped_disabled when stage is off", () => {
    expect(checkEligibility(makeEligibilityInput({ enabled: false }))).toEqual({ kind: "skipped_disabled" });
  });

  it("returns skipped_short when below minInputChars", () => {
    expect(checkEligibility(makeEligibilityInput({ inputChars: 50 }))).toEqual({ kind: "skipped_short" });
  });

  it("returns skipped_too_long when above maxInputChars > 0", () => {
    expect(checkEligibility(makeEligibilityInput({ inputChars: 6000 }))).toEqual({ kind: "skipped_too_long" });
  });

  it("returns eligible when maxInputChars is disabled", () => {
    expect(checkEligibility(makeEligibilityInput({ inputChars: 9999, maxInputChars: 0 }))).toEqual({ kind: "eligible" });
  });

  it("returns skipped_too_long when input+output exceeds context window", () => {
    expect(checkEligibility(makeEligibilityInput({ inputChars: 1000, charsPerToken: 1, contextTokens: 100, maxInputChars: 0 })))
      .toEqual({ kind: "skipped_too_long" });
  });

  it("returns eligible when everything fits", () => {
    expect(checkEligibility(makeEligibilityInput())).toEqual({ kind: "eligible" });
  });
});
