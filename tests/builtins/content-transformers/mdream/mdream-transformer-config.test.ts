/** Verifies the mdream content transformer config parsing. */
import { describe, expect, it } from "vitest";

import { parseMdreamTransformerConfig } from "../../../../src/builtins/content-transformers/mdream/mdream-transformer-config.js";

describe("parseMdreamTransformerConfig", () => {
  it("applies defaults", () => {
    expect(parseMdreamTransformerConfig({})).toEqual({ minimal: false, clean: true });
  });

  it("coerces env-substituted boolean strings", () => {
    expect(parseMdreamTransformerConfig({ minimal: "true", clean: "false" })).toEqual({ minimal: true, clean: false });
  });

  it("rejects unknown keys", () => {
    expect(() => parseMdreamTransformerConfig({ unexpected: true })).toThrow();
  });
});
