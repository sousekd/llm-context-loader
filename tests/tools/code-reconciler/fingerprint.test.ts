import { describe, expect, it } from "vitest";

import { createCodeFingerprint } from "../../../src/tools/code-reconciler/fingerprint.js";

describe("createCodeFingerprint", () => {
  it("captures line counts, boundaries, hashes, and tokens", () => {
    const fingerprint = createCodeFingerprint("\nconst x = 1;\nreturn x;\n");

    expect(fingerprint).toMatchObject({ lineCount: 3, nonEmptyLineCount: 2, charCount: 24, firstNonEmptyLine: "const x = 1;", lastNonEmptyLine: "return x;" });
    expect(fingerprint.normalizedLineHashes).toHaveLength(3);
    expect(fingerprint.tokenSet.has("const")).toBe(true);
  });

  it("supports custom tokenizers", () => {
    const fingerprint = createCodeFingerprint("abc", { tokenize: (code) => [code] });

    expect([...fingerprint.tokenSet]).toEqual(["abc"]);
  });
});
