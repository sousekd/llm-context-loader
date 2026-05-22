import { describe, expect, it } from "vitest";

import type { MatchResult } from "../../../src/tools/shared/match-result.js";

function summarize(result: MatchResult<string>): string {
  if (result.kind === "match") return result.record;
  if (result.kind === "ambiguous") return result.records.join(",");
  return "none";
}

describe("MatchResult", () => {
  it("narrows the match variant", () => {
    expect(summarize({ kind: "match", record: "a" })).toBe("a");
  });

  it("narrows the ambiguous variant", () => {
    expect(summarize({ kind: "ambiguous", records: ["a", "b"] })).toBe("a,b");
  });

  it("narrows the none variant", () => {
    expect(summarize({ kind: "none" })).toBe("none");
  });
});
