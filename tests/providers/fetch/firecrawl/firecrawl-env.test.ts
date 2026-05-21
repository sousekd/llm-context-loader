import { describe, expect, it } from "vitest";

import { parseFirecrawlEnv } from "../../../../src/providers/fetch/firecrawl/firecrawl-env.js";

describe("parseFirecrawlEnv", () => {
  it("returns defaults", () => {
    const config = parseFirecrawlEnv({} as NodeJS.ProcessEnv);

    expect(config).toEqual({
      FIRECRAWL_BASE_URL: "http://firecrawl-api:3002",
      FIRECRAWL_API_KEY: "",
      FIRECRAWL_ONLY_MAIN_CONTENT: true
    });
  });

  it("returns overrides", () => {
    const config = parseFirecrawlEnv({
      FIRECRAWL_BASE_URL: "https://api.firecrawl.dev",
      FIRECRAWL_API_KEY: "fc-key",
      FIRECRAWL_ONLY_MAIN_CONTENT: "false"
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      FIRECRAWL_BASE_URL: "https://api.firecrawl.dev",
      FIRECRAWL_API_KEY: "fc-key",
      FIRECRAWL_ONLY_MAIN_CONTENT: false
    });
  });

  it("throws for invalid base URLs", () => {
    expect(() => parseFirecrawlEnv({ FIRECRAWL_BASE_URL: "not-a-url" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("throws for invalid boolean values", () => {
    expect(() => parseFirecrawlEnv({ FIRECRAWL_ONLY_MAIN_CONTENT: "maybe" } as NodeJS.ProcessEnv)).toThrow();
  });
});