/** Verifies Docling provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseDoclingConfig } from "../../../../src/builtins/source-providers/docling/docling-provider-config.js";

describe("parseDoclingConfig", () => {
  it("applies defaults and coerces env-substituted scalar strings", () => {
    expect(parseDoclingConfig({ baseUrl: "http://docling.example" })).toMatchObject({
      apiKey: "",
      doOcr: true,
      tableMode: "accurate"
    });
    expect(
      parseDoclingConfig({ baseUrl: "http://docling.example", doOcr: " false ", tableMode: "fast" })
    ).toMatchObject({
      doOcr: false,
      tableMode: "fast"
    });
    expect(parseDoclingConfig({ baseUrl: "http://docling.example", doOcr: "", apiKey: "" })).toMatchObject({
      doOcr: true,
      apiKey: ""
    });
  });

  it("rejects invalid boolean strings", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", doOcr: "yes" })).toThrow();
  });

  it("rejects invalid tableMode values", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", tableMode: "exact" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", mystery: true })).toThrow();
  });
});
