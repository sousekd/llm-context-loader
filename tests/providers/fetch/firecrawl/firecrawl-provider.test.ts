import { describe, expect, it } from "vitest";

import type { AppConfig } from "../../../../src/config/config.js";

import { AppError } from "../../../../src/core/util/errors.js";
import { parseFirecrawlEnv } from "../../../../src/providers/fetch/firecrawl/firecrawl-env.js";
import { FirecrawlFetchProvider, type FetchFn } from "../../../../src/providers/fetch/firecrawl/firecrawl-provider.js";
import { buildTestConfig, jsonResponse } from "../../../helpers/index.js";

function makeConfig(overrides: Record<string, string> = {}): AppConfig {
  return buildTestConfig({ FETCH_TIMEOUT_SECONDS: "1", ...overrides });
}

function makeFirecrawlConfig(overrides: Record<string, string> = {}) {
  return parseFirecrawlEnv({ ...overrides } as NodeJS.ProcessEnv);
}

describe("FirecrawlFetchProvider", () => {
  it("returns markdown and metadata on a successful response", async () => {
    const fetchFn: FetchFn = async () => {
      return jsonResponse({
        success: true,
        data: { markdown: "# hello", metadata: { title: "Hello", statusCode: 200, contentType: "text/html" } }
      });
    };
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig(), { fetchFn });

    const document = await provider.fetch("https://example.com");

    expect(document).toMatchObject({
      url: "https://example.com",
      title: "Hello",
      markdown: "# hello",
      statusCode: 200,
      contentType: "text/html"
    });
  });

  it("sends the supported Firecrawl scrape request body", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: FetchFn = async (input, init) => {
      requestBody = JSON.parse(String(init?.body));
      expect(String(input)).toBe("https://firecrawl.example/v2/scrape");
      expect(init?.method).toBe("POST");
      return jsonResponse({ success: true, data: { markdown: "# ok", metadata: {} } });
    };
    const provider = new FirecrawlFetchProvider(
      makeConfig(),
      makeFirecrawlConfig({ FIRECRAWL_BASE_URL: "https://firecrawl.example", FIRECRAWL_ONLY_MAIN_CONTENT: "false" }),
      { fetchFn }
    );

    await provider.fetch("https://example.com/page");

    expect(requestBody).toEqual({
      url: "https://example.com/page",
      formats: ["markdown"],
      onlyMainContent: false
    });
    expect(requestBody).not.toHaveProperty("onlyCleanContent");
  });

  it("sends bearer authorization when Firecrawl API key is configured", async () => {
    let authorization: string | undefined;
    const fetchFn: FetchFn = async (_input, init) => {
      authorization = (init?.headers as Record<string, string>).authorization;
      return jsonResponse({ success: true, data: { markdown: "# ok", metadata: {} } });
    };
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig({ FIRECRAWL_API_KEY: "fc-key" }), { fetchFn });

    await provider.fetch("https://example.com");

    expect(authorization).toBe("Bearer fc-key");
  });

  it("throws firecrawl_non_json when body is not JSON", async () => {
    const fetchFn: FetchFn = async () =>
      new Response("<html>nope</html>", { status: 200, headers: { "content-type": "text/html" } });
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig(), { fetchFn });

    await expect(provider.fetch("https://example.com")).rejects.toMatchObject({
      code: "firecrawl_non_json",
      statusCode: 502
    });
  });

  it("slugifies upstream code on success=false payload", async () => {
    const fetchFn: FetchFn = async () =>
      jsonResponse({ success: false, code: "Rate; Limit!!", error: "slow down" }, { status: 429 });
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig(), { fetchFn });

    await expect(provider.fetch("https://example.com")).rejects.toMatchObject({
      code: "rate_limit",
      statusCode: 502
    });
  });

  it("throws firecrawl_missing_markdown when data.markdown is absent", async () => {
    const fetchFn: FetchFn = async () => jsonResponse({ success: true, data: { metadata: {} } });
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig(), { fetchFn });

    await expect(provider.fetch("https://example.com")).rejects.toMatchObject({
      code: "firecrawl_missing_markdown",
      statusCode: 502
    });
  });

  it("translates AbortError into firecrawl_timeout", async () => {
    const fetchFn: FetchFn = async (_input, init) => {
      await new Promise((resolve, reject) => {
        const signal = (init?.signal ?? null) as AbortSignal | null;
        if (!signal) {
          reject(new Error("test setup: signal expected"));
          return;
        }
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
      throw new Error("unreachable");
    };
    const provider = new FirecrawlFetchProvider(makeConfig({ FETCH_TIMEOUT_SECONDS: "0" }), makeFirecrawlConfig(), { fetchFn });

    await expect(provider.fetch("https://example.com")).rejects.toMatchObject({
      name: "AppError",
      code: "firecrawl_timeout",
      statusCode: 504
    });
  });

  it("wraps non-AppError fetch failures", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("network broke");
    };
    const provider = new FirecrawlFetchProvider(makeConfig(), makeFirecrawlConfig(), { fetchFn });

    await expect(provider.fetch("https://example.com")).rejects.toBeInstanceOf(AppError);
    await expect(provider.fetch("https://example.com")).rejects.toMatchObject({ code: "firecrawl_request_failed", statusCode: 502 });
  });
});
