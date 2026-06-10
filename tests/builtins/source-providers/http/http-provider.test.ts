/** Verifies HTTP source-provider request, response, and failure behavior. */
import { describe, expect, it } from "vitest";

import { parseHttpConfig } from "../../../../src/builtins/source-providers/http/http-provider-config.js";
import { HttpProvider } from "../../../../src/builtins/source-providers/http/http-provider.js";
import { createTestLogger } from "../../../helpers/logger.js";

describe("HttpProvider", () => {
  it("fetches a URL and returns the raw body with title from <title>", async () => {
    const fetchFn: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://example.com");
      expect((init?.headers as Record<string, string>)?.["user-agent"]).toBeTruthy();
      return new Response("<html><head><title>  My Page  </title></head><body>Hello</body></html>");
    };
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({
      kind: "text",
      content: expect.stringContaining("Hello"),
      mediaType: "text/plain",
      title: "My Page",
      truncated: false
    });
  });

  it("omits title when titleFromHtml is false", async () => {
    const fetchFn: typeof fetch = async () => new Response("<html><title>Test</title></html>");
    const provider = new HttpProvider(parseHttpConfig({ titleFromHtml: false }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({
      kind: "text",
      content: expect.stringContaining("Test"),
      mediaType: "text/plain",
      truncated: false
    });
  });

  it("sets the configured user agent", async () => {
    let userAgent: string | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      userAgent = (init?.headers as Record<string, string>)?.["user-agent"];
      return new Response("content");
    };
    const provider = new HttpProvider(parseHttpConfig({ userAgent: "test-bot/1.0" }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(userAgent).toBe("test-bot/1.0");
  });

  it("truncates oversized response bodies", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("a".repeat(500)));
        controller.enqueue(encoder.encode("b".repeat(500)));
        controller.close();
      }
    });
    const fetchFn: typeof fetch = async () => new Response(stream);
    const provider = new HttpProvider(parseHttpConfig({ maxBytes: 100 }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") {
      expect(document.content.length).toBe(100);
      expect(document.content).toBe("a".repeat(100));
    }
    expect(document.truncated).toBe(true);
  });

  it("truncates at a chunk boundary when the cap lands mid-chunk", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("a".repeat(500)));
        controller.enqueue(encoder.encode("b".repeat(500)));
        controller.close();
      }
    });
    const fetchFn: typeof fetch = async () => new Response(stream);
    const provider = new HttpProvider(parseHttpConfig({ maxBytes: 600 }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") {
      expect(document.content.length).toBe(600);
      expect(document.content).toBe("a".repeat(500) + "b".repeat(100));
    }
    expect(document.truncated).toBe(true);
  });

  it("reports truncated when a streamed body exactly fills the cap before more data", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("a".repeat(100)));
        controller.enqueue(encoder.encode("b"));
        controller.close();
      }
    });
    const fetchFn: typeof fetch = async () => new Response(stream);
    const provider = new HttpProvider(parseHttpConfig({ maxBytes: 100 }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") expect(document.content).toBe("a".repeat(100));
    expect(document.truncated).toBe(true);
  });

  it("reports not truncated when a streamed body fits within the cap", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("a".repeat(50)));
        controller.close();
      }
    });
    const fetchFn: typeof fetch = async () => new Response(stream);
    const provider = new HttpProvider(parseHttpConfig({ maxBytes: 100 }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") expect(document.content).toBe("a".repeat(50));
    expect(document.truncated).toBe(false);
  });

  it("wraps stream read failures as UpstreamError", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([104, 105])); // "hi"
        controller.error(new TypeError("stream corrupted"));
      }
    });
    const fetchFn: typeof fetch = async () => new Response(stream);
    const provider = new HttpProvider(parseHttpConfig({ maxBytes: 100 }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "network"
    });
  });

  it("rejects non-ok HTTP status", async () => {
    const fetchFn: typeof fetch = async () => new Response("Not Found", { status: 404 });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "http_404",
      upstreamStatus: 404
    });
  });

  it("returns application/pdf as a binary body", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.7...");
    const fetchFn: typeof fetch = async () =>
      new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toMatchObject({
      kind: "binary",
      mediaType: "application/pdf",
      truncated: false
    });
  });

  it("returns binary for application/pdf and reads the body", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { "content-type": "application/pdf" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("binary");
    if (document.kind === "binary") expect(document.bytes.byteLength).toBeGreaterThan(0);
  });

  it("returns application/octet-stream body as binary", async () => {
    const raw = new Uint8Array([104, 105, 0, 101]);
    const fetchFn: typeof fetch = async () =>
      new Response(raw, {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("binary");
    if (document.kind === "binary") {
      expect(document.mediaType).toBe("application/octet-stream");
      expect(document.bytes).toEqual(raw);
    }
  });

  it("reclassifies a missing header with NUL bytes as binary", async () => {
    const raw = new Uint8Array([78, 0, 97, 0, 109, 0, 101]);
    const fetchFn: typeof fetch = async () => new Response(raw);
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("binary");
    if (document.kind === "binary") expect(document.bytes).toEqual(raw);
  });

  it("accepts text/html content type", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") expect(document.content).toContain("Hello");
    expect(document.mediaType).toBe("text/html");
  });

  it("returns text/markdown for text/markdown content type", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("# Markdown body", {
        status: 200,
        headers: { "content-type": "text/markdown" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.mediaType).toBe("text/markdown");
  });

  it("preserves application/json content type", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response('{"key": "value"}', {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") expect(document.content).toBe('{"key": "value"}');
    expect(document.mediaType).toBe("application/json");
  });

  it("preserves other textual content types (no collapse to text/plain)", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("css", {
        status: 200,
        headers: { "content-type": "text/css" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.mediaType).toBe("text/css");
  });

  it("preserves structured +xml content types", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("<rss><channel /></rss>", {
        status: 200,
        headers: { "content-type": "application/rss+xml; charset=utf-8" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.mediaType).toBe("application/rss+xml");
  });

  it("accepts clean text with no content-type header", async () => {
    const fetchFn: typeof fetch = async () => new Response("just text, no NUL bytes");
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.kind).toBe("text");
    if (document.kind === "text") expect(document.content).toBe("just text, no NUL bytes");
  });

  it("rejects empty body as upstream empty response", async () => {
    const fetchFn: typeof fetch = async () => new Response("   ");
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "empty",
      upstreamStatus: 200
    });
  });

  it("wraps network failures as UpstreamError", async () => {
    const fetchFn: typeof fetch = async () => {
      throw new Error("connection refused");
    };
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "network"
    });
  });

  it("forwards AbortSignal and lets abort errors propagate", async () => {
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    let signalFromInit: AbortSignal | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      signalFromInit = init?.signal ?? undefined;
      throw abort;
    };
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: controller.signal })).rejects.toBe(abort);
    expect(signalFromInit).toBe(controller.signal);
  });
});
