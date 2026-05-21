import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/config.js";

describe("loadConfig", () => {
  it("returns documented defaults", () => {
    const config = loadConfig({} as NodeJS.ProcessEnv);

    expect(config.CLIENTS).toBe("openwebui,jina");
    expect(config.CLEAN_ENABLED).toBe(true);
    expect(config.SUMMARIZE_ENABLED).toBe(false);
    expect(config.TRUNCATE_TARGET_CHARS).toBe(25000);
    expect(config.LLM_CONCURRENCY).toBe(1);
  });

  it("coerces typed environment values", () => {
    const config = loadConfig({
      AUTH_ENABLED: "true",
      API_KEY: "secret",
      CLEAN_ENABLED: "false",
      FETCH_CONCURRENCY: "7",
      CLEAN_OUTPUT_RATIO: "0.25"
    } as NodeJS.ProcessEnv);

    expect(config.AUTH_ENABLED).toBe(true);
    expect(config.CLEAN_ENABLED).toBe(false);
    expect(config.FETCH_CONCURRENCY).toBe(7);
    expect(config.CLEAN_OUTPUT_RATIO).toBe(0.25);
  });

  it("throws for invalid boolean values", () => {
    expect(() => loadConfig({ CLEAN_ENABLED: "maybe" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
  });

  it("throws for out-of-range numeric values", () => {
    expect(() => loadConfig({ LLM_CONCURRENCY: "0" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ CLEAN_OUTPUT_RATIO: "-1" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
  });

  it("throws when authentication is enabled without a token", () => {
    expect(() => loadConfig({ AUTH_ENABLED: "true" } as NodeJS.ProcessEnv)).toThrow(/requires API_KEY/);
  });

  it("leaves provider-specific keys outside core config", () => {
    const config = loadConfig({
      FIRECRAWL_BASE_URL: "https://firecrawl.example",
      FIRECRAWL_API_KEY: "fc-key"
    } as NodeJS.ProcessEnv);

    expect("FIRECRAWL_BASE_URL" in config).toBe(false);
    expect("FIRECRAWL_API_KEY" in config).toBe(false);
  });

  it("defaults LLM_EXTRA_BODY to an empty object", () => {
    const config = loadConfig({} as NodeJS.ProcessEnv);

    expect(config.LLM_EXTRA_BODY).toEqual({});
  });

  it("parses LLM_EXTRA_BODY as a JSON object", () => {
    const config = loadConfig({
      LLM_EXTRA_BODY: '{"temperature":0.7,"top_k":20}'
    } as NodeJS.ProcessEnv);

    expect(config.LLM_EXTRA_BODY).toEqual({ temperature: 0.7, top_k: 20 });
  });

  it("throws when LLM_EXTRA_BODY is not valid JSON", () => {
    expect(() => loadConfig({ LLM_EXTRA_BODY: "not json" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
  });

  it("throws when LLM_EXTRA_BODY is JSON but not an object", () => {
    expect(() => loadConfig({ LLM_EXTRA_BODY: "[1,2,3]" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ LLM_EXTRA_BODY: "null" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ LLM_EXTRA_BODY: '"hello"' } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ LLM_EXTRA_BODY: "42" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration/);
  });
});
