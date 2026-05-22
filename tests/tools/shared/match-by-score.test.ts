import { describe, expect, it } from "vitest";

import { matchByScore } from "../../../src/tools/shared/match-by-score.js";

describe("matchByScore", () => {
  it("returns none when no record clears the minimum score", () => {
    expect(matchByScore([{ id: "a", score: 0.4 }], { minScore: 0.5, score: (record) => record.score })).toEqual({ kind: "none" });
  });

  it("returns the highest record when it clears the margin", () => {
    expect(matchByScore([{ id: "a", score: 0.9 }, { id: "b", score: 0.7 }], { minScore: 0.5, minMargin: 0.1, score: (record) => record.score })).toMatchObject({ kind: "match", record: { id: "a" } });
  });

  it("returns ambiguous records inside the margin", () => {
    const result = matchByScore([{ id: "a", score: 0.9 }, { id: "b", score: 0.85 }, { id: "c", score: 0.7 }], {
      minScore: 0.5,
      minMargin: 0.1,
      score: (record) => record.score
    });

    expect(result).toMatchObject({ kind: "ambiguous", records: [{ id: "a" }, { id: "b" }] });
  });

  it("treats a score difference equal to the margin as ambiguous", () => {
    const result = matchByScore([{ id: "a", score: 0.9 }, { id: "b", score: 0.8 }], {
      minScore: 0.5,
      minMargin: 0.1,
      score: (record) => record.score
    });

    expect(result).toMatchObject({ kind: "ambiguous", records: [{ id: "a" }, { id: "b" }] });
  });

  it("treats equal top scores as ambiguous by default", () => {
    expect(matchByScore([{ id: "a", score: 1 }, { id: "b", score: 1 }], { minScore: 0, score: (record) => record.score }).kind).toBe("ambiguous");
  });
});
