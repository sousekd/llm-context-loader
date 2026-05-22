import { describe, expect, it } from "vitest";

import { toMatchResult } from "../../../src/tools/shared/to-match-result.js";

describe("toMatchResult", () => {
  it("returns kind=none for empty input", () => {
    expect(toMatchResult([])).toEqual({ kind: "none" });
  });

  it("returns kind=match for a single record", () => {
    expect(toMatchResult(["a"])).toEqual({ kind: "match", record: "a" });
  });

  it("returns kind=ambiguous with the full list for multiple records", () => {
    expect(toMatchResult(["a", "b"])).toEqual({ kind: "ambiguous", records: ["a", "b"] });
  });
});

