/** Verifies Firecrawl provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseFirecrawlConfig } from "../../../../src/builtins/source-providers/firecrawl/firecrawl-provider-config.js";

describe("parseFirecrawlConfig", () => {
  it("applies defaults and coerces env-substituted scalar strings", () => {
    expect(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" })).toMatchObject({
      onlyMainContent: true,
      maxAge: 0
    });
    expect(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", onlyMainContent: " false ", maxAge: "30" })
    ).toMatchObject({
      onlyMainContent: false,
      maxAge: 30
    });
    expect(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", onlyMainContent: "", maxAge: "" })
    ).toMatchObject({
      onlyMainContent: true,
      maxAge: 0
    });
  });

  it("rejects invalid boolean strings", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", onlyMainContent: "yes" })).toThrow();
  });

  it("rejects invalid numeric limits", () => {
    expect(() => parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", maxAge: "abc" })).toThrow();
  });
});
