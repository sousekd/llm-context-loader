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
        output: "markdown",
        onlyMainContent: false,
        stripBase64Images: true,
        parsePdf: true
      }),
      { httpFetch: fetchFn, logger: createTestLogger() }
    );

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody).toEqual({
      url: "https://example.com",
      formats: ["markdown"],
      onlyMainContent: false,
      removeBase64Images: true,
      parsers: ["pdf"]
    });
    expect(document).toEqual({ content: "# hello", mediaType: "text/markdown", title: "Hello" });
  });

  it("returns html content when output is html", async () => {
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "html" }),
      {
        httpFetch: async () =>
          jsonResponse({ success: true, data: { html: "<p>Hello</p>", metadata: { title: "Hello" } } }),
        logger: createTestLogger()
      }
    );

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({ content: "<p>Hello</p>", mediaType: "text/html", title: "Hello" });
  });

  it("returns rawHtml content when output is rawHtml", async () => {
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "rawHtml" }),
      {
        httpFetch: async () => jsonResponse({ success: true, data: { rawHtml: "<html><body>Raw</body></html>" } }),
        logger: createTestLogger()
      }
    );

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({ content: "<html><body>Raw</body></html>", mediaType: "text/html" });
  });

  it("omits parsers when parsePdf is false", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ success: true, data: { markdown: "ok" } });
    };
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", parsePdf: false }),
      { httpFetch: fetchFn, logger: createTestLogger() }
    );

    await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody?.parsers).toEqual([]);
  });

  it("accepts top-level response fields for any output format", async () => {
    const mdProvider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "markdown" }),
      {
        httpFetch: async () => jsonResponse({ success: true, markdown: "# top", title: "MdTop" }),
        logger: createTestLogger()
      }
    );
    const htmlProvider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "html" }),
      {
        httpFetch: async () => jsonResponse({ success: true, html: "<p>top</p>", title: "HtmlTop" }),
        logger: createTestLogger()
      }
    );
    const rawProvider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "rawHtml" }),
      {
        httpFetch: async () => jsonResponse({ success: true, rawHtml: "<html>raw</html>", title: "RawTop" }),
        logger: createTestLogger()
      }
    );

    await expect(mdProvider.load("https://example.com", { signal: new AbortController().signal })).resolves.toEqual({
      content: "# top",
      mediaType: "text/markdown",
      title: "MdTop"
    });
    await expect(htmlProvider.load("https://example.com", { signal: new AbortController().signal })).resolves.toEqual({
      content: "<p>top</p>",
      mediaType: "text/html",
      title: "HtmlTop"
    });
    await expect(rawProvider.load("https://example.com", { signal: new AbortController().signal })).resolves.toEqual({
      content: "<html>raw</html>",
      mediaType: "text/html",
      title: "RawTop"
    });
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

  it("rejects empty content as an upstream empty response for any output", async () => {
    const provider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "markdown" }),
      {
        httpFetch: async () => jsonResponse({ success: true, data: { markdown: "   " } }),
        logger: createTestLogger()
      }
    );

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "empty"
    });

    const htmlProvider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "html" }),
      {
        httpFetch: async () => jsonResponse({ success: true, data: { html: "   " } }),
        logger: createTestLogger()
      }
    );
    await expect(
      htmlProvider.load("https://example.com", { signal: new AbortController().signal })
    ).rejects.toMatchObject({
      upstreamCode: "empty"
    });

    const rawProvider = new FirecrawlProvider(
      parseFirecrawlConfig({ baseUrl: "https://firecrawl.example", output: "rawHtml" }),
      {
        httpFetch: async () => jsonResponse({ success: true, data: { rawHtml: "   " } }),
        logger: createTestLogger()
      }
    );
    await expect(
      rawProvider.load("https://example.com", { signal: new AbortController().signal })
    ).rejects.toMatchObject({
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
