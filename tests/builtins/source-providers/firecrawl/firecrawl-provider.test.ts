/** Verifies Firecrawl source-provider request, response, and failure behavior. */
import { describe, expect, it } from "vitest";

import { UpstreamError } from "../../../../src/shared/errors.js";
import { parseFirecrawlConfig } from "../../../../src/builtins/source-providers/firecrawl/firecrawl-provider-config.js";
import { FirecrawlProvider } from "../../../../src/builtins/source-providers/firecrawl/firecrawl-provider.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { jsonResponse } from "../../../helpers/responses.js";

describe("FirecrawlProvider", () => {
  it("sends the supported scrape request and returns markdown content", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      requestBody = JSON.parse(String(init?.body));
      expect(String(input)).toBe("https://firecrawl.example/v2/scrape");
      expect(init?.method).toBe("POST");
      return jsonResponse({ success: true, data: { markdown: "# hello", metadata: { title: "Hello" } } });
    };
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({
        baseUrl: "https://firecrawl.example",
        apiKey: "",
        onlyMainContent: false,
        formats: ["markdown"],
        maxAge: 0
      }),
      { httpFetch: fetchFn, logger: createTestLogger() }
    );

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody).toEqual({
      url: "https://example.com",
      formats: ["markdown"],
      onlyMainContent: false,
      maxAge: 0
    });
    expect(document).toEqual({ content: "# hello", title: "Hello" });
  });

  it("accepts top-level markdown response fields", async () => {
    const provider = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async () => jsonResponse({ success: true, markdown: "# top", title: "Top" }),
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({ content: "# top", title: "Top" });
  });

  it("sends bearer authorization when an API key is configured", async () => {
    let authorization: string | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      authorization = (init?.headers as Record<string, string>).authorization;
      return jsonResponse({ success: true, data: { markdown: "ok" } });
    };
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", apiKey: "fc-key" }),
      {
        httpFetch: fetchFn,
        logger: createTestLogger()
      }
    );

    await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(authorization).toBe("Bearer fc-key");
  });

  it("preserves sanitized upstream codes from failed payloads", async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse({ success: false, code: "Rate; Limit!!", error: "slow down" }, { status: 429 });
    const provider = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "rate_limit",
      upstreamStatus: 429
    });
  });

  it("rejects empty markdown as an upstream empty response", async () => {
    const provider = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async () => jsonResponse({ success: true, data: { markdown: "   " } }),
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "empty"
    });
  });

  it("wraps non-JSON and network failures as UpstreamError", async () => {
    const nonJson = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async () => new Response("<html></html>", { status: 200 }),
      logger: createTestLogger()
    });
    await expect(nonJson.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "parse_error"
    });

    const network = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async () => {
        throw new Error("network broke");
      },
      logger: createTestLogger()
    });
    await expect(network.load("https://example.com", { signal: new AbortController().signal })).rejects.toBeInstanceOf(
      UpstreamError
    );
    await expect(network.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "network"
    });
  });

  it("forwards AbortSignal and lets abort errors propagate", async () => {
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    let signal: AbortSignal | null | undefined;
    const provider = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async (_input, init) => {
        signal = init?.signal;
        throw abort;
      },
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: controller.signal })).rejects.toBe(abort);

    expect(signal).toBe(controller.signal);
  });

  it("lets abort errors from JSON parsing propagate", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const response = jsonResponse({ success: true, data: { markdown: "ok" } });
    Object.defineProperty(response, "json", { value: async () => Promise.reject(abort) });
    const provider = new FirecrawlProvider(parseFirecrawlConfig({ baseUrl: "https://firecrawl.example" }), {
      httpFetch: async () => response,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toBe(abort);
  });
});
