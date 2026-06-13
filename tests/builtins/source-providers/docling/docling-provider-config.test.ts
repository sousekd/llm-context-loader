/** Verifies Docling provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseDoclingConfig } from "../../../../src/builtins/source-providers/docling/docling-provider-config.js";

describe("parseDoclingConfig", () => {
  it("applies defaults and coerces env-substituted scalar strings", () => {
    expect(parseDoclingConfig({ baseUrl: "http://docling.example" })).toMatchObject({
      apiKey: "",
      output: "markdown",
      options: {}
    });
    expect(parseDoclingConfig({ baseUrl: "http://docling.example", apiKey: "", output: "" })).toMatchObject({
      output: "markdown",
      apiKey: ""
    });
  });

  it("preserves opaque options verbatim", () => {
    const config = parseDoclingConfig({
      baseUrl: "http://docling.example",
      options: { do_ocr: false, table_mode: "fast", ocr_preset: "easyocr", nested: { force_full_page_ocr: true } }
    });
    expect(config.options).toEqual({
      do_ocr: false,
      table_mode: "fast",
      ocr_preset: "easyocr",
      nested: { force_full_page_ocr: true }
    });
  });

  it("parses a JSON-string blob from a single env var", () => {
    const config = parseDoclingConfig({
      baseUrl: "http://docling.example",
      options: '{"do_ocr":false,"table_mode":"fast"}'
    });
    expect(config.options).toEqual({ do_ocr: false, table_mode: "fast" });
  });

  it("coerces a blank env var to empty options", () => {
    const config = parseDoclingConfig({ baseUrl: "http://docling.example", options: "" });
    expect(config.options).toEqual({});
  });

  it("passes through inline objects (non-string) unmodified", () => {
    const config = parseDoclingConfig({
      baseUrl: "http://docling.example",
      options: { pipeline: "standard" }
    });
    expect(config.options).toEqual({ pipeline: "standard" });
  });

  it("rejects invalid JSON string", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", options: "{invalid" })).toThrow();
  });

  it("rejects invalid output values", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", output: "rawHtml" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => parseDoclingConfig({ baseUrl: "http://docling.example", mystery: true })).toThrow();
  });
});
