/** Verifies HTTP provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseHttpConfig } from "../../../../src/builtins/source-providers/http/http-provider-config.js";

describe("parseHttpConfig", () => {
  it("applies defaults and coerces env-substituted scalar strings", () => {
    expect(parseHttpConfig({})).toMatchObject({
      maxBytes: 5_000_000,
      titleFromHtml: true
    });
    expect(parseHttpConfig({ maxBytes: "100", titleFromHtml: " false " })).toMatchObject({
      maxBytes: 100,
      titleFromHtml: false
    });
    expect(parseHttpConfig({ maxBytes: "", titleFromHtml: "" })).toMatchObject({
      maxBytes: 5_000_000,
      titleFromHtml: true
    });
  });

  it("rejects invalid boolean strings", () => {
    expect(() => parseHttpConfig({ titleFromHtml: "yes" })).toThrow();
  });

  it("rejects non-positive maxBytes", () => {
    expect(() => parseHttpConfig({ maxBytes: -1 })).toThrow();
    expect(() => parseHttpConfig({ maxBytes: 0 })).toThrow();
  });

  it("rejects invalid numeric maxBytes", () => {
    expect(() => parseHttpConfig({ maxBytes: "abc" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => parseHttpConfig({ mystery: true })).toThrow();
  });
});
