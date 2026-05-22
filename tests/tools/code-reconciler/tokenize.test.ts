import { describe, expect, it } from "vitest";

import { tokenizeCodeWords } from "../../../src/tools/code-reconciler/tokenize.js";

describe("tokenizeCodeWords", () => {
  it("extracts identifier-like and number-like tokens", () => {
    expect(tokenizeCodeWords("const answer_value = 42.5;")).toEqual(["const", "answer_value", "42.5"]);
  });

  it("can preserve case", () => {
    expect(tokenizeCodeWords("CamelCase", { lowercase: false })).toEqual(["CamelCase"]);
  });
});
