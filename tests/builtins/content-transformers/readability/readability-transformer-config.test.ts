/** Verifies the readability content transformer config parsing. */
import { describe, expect, it } from "vitest";

import { parseReadabilityTransformerConfig } from "../../../../src/builtins/content-transformers/readability/readability-transformer-config.js";

describe("parseReadabilityTransformerConfig", () => {
  it("applies defaults for all fields", () => {
    expect(parseReadabilityTransformerConfig({})).toEqual({
      minContentLength: 140,
      minScore: 20,
      maxElements: 0
    });
  });

  it("parses explicit numeric values", () => {
    expect(
      parseReadabilityTransformerConfig({
        minContentLength: "100",
        minScore: "15",
        maxElements: "50"
      })
    ).toEqual({
      minContentLength: 100,
      minScore: 15,
      maxElements: 50
    });
  });

  it("treats blank strings as undefined (env placeholder fallback)", () => {
    expect(
      parseReadabilityTransformerConfig({
        minContentLength: "",
        minScore: "",
        maxElements: ""
      })
    ).toEqual({
      minContentLength: 140,
      minScore: 20,
      maxElements: 0
    });
  });

  it("rejects negative minContentLength", () => {
    expect(() => parseReadabilityTransformerConfig({ minContentLength: "-1" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => parseReadabilityTransformerConfig({ extra: 1 })).toThrow();
  });
});
