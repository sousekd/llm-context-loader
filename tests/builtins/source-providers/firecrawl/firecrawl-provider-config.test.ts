/** Verifies Firecrawl provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseFirecrawlConfig } from "../../../../src/builtins/source-providers/firecrawl/firecrawl-provider-config.js";

describe("parseFirecrawlConfig", () => {
  it("applies defaults and coerces env-substituted blank strings", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" })).toMatchObject({
      output: "markdown",
      options: {}
    });
  });

  it("coerces blank output to markdown", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "" })).toMatchObject({
      output: "markdown"
    });
  });

  it("parses options from a JSON string", () => {
    expect(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", options: '{"onlyMainContent":false}' })
    ).toMatchObject({
      options: { onlyMainContent: false }
    });
  });

  it("returns empty options for blank env vars", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", options: "" })).toMatchObject({
      options: {}
    });
  });

  it("passes through inline YAML object options", () => {
    expect(
      parseFirecrawlConfig({
        baseUrl: "https://firecrawl.example",
        options: { onlyMainContent: false, timeout: 30000 }
      })
    ).toMatchObject({
      options: { onlyMainContent: false, timeout: 30000 }
    });
  });

  it("rejects invalid JSON in options", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", options: "not-json" })).toThrow();
  });

  it("accepts rawHtml output", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "rawHtml" })).toMatchObject({
      output: "rawHtml"
    });
  });

  it("rejects invalid output values", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "markup" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", maxAge: 0 })).toThrow();
  });
});
