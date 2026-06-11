/** Verifies Firecrawl provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseFirecrawlConfig } from "../../../../src/builtins/source-providers/firecrawl/firecrawl-provider-config.js";

describe("parseFirecrawlConfig", () => {
  it("applies defaults and coerces env-substituted scalar strings", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" })).toMatchObject({
      output: "markdown",
      onlyMainContent: true,
      stripBase64Images: true,
      parsePdf: true
    });
    expect(
      parseFirecrawlConfig({
        baseUrl: "https://firecrawl.example",
        output: "html",
        onlyMainContent: " false ",
        stripBase64Images: " false ",
        parsePdf: " false "
      })
    ).toMatchObject({
      output: "html",
      onlyMainContent: false,
      stripBase64Images: false,
      parsePdf: false
    });
    expect(
      parseFirecrawlConfig({
        baseUrl: "https://firecrawl.example",
        onlyMainContent: "",
        stripBase64Images: "",
        parsePdf: ""
      })
    ).toMatchObject({
      onlyMainContent: true,
      stripBase64Images: true,
      parsePdf: true
    });
  });

  it("accepts rawHtml output", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "rawHtml" })).toMatchObject({
      output: "rawHtml"
    });
  });

  it("rejects invalid boolean strings", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", onlyMainContent: "yes" })).toThrow();
  });

  it("rejects invalid output values", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "markup" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", maxAge: 0 })).toThrow();
  });
});
