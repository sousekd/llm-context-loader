/** Verifies HTTP source-provider request, response, and failure behavior. */
import { describe, expect, it } from "vitest";

import { UpstreamError } from "../../../../src/shared/errors.js";
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

    expect(document).toEqual({ content: expect.stringContaining("Hello"), title: "My Page", truncated: false });
  });

  it("omits title when titleFromHtml is false", async () => {
    const fetchFn: typeof fetch = async () => new Response("<html><title>Test</title></html>");
    const provider = new HttpProvider(parseHttpConfig({ titleFromHtml: false }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({ content: expect.stringContaining("Test"), truncated: false });
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

    expect(document.content.length).toBe(100);
    expect(document.content).toBe("a".repeat(100));
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

    expect(document.content.length).toBe(600);
    expect(document.content).toBe("a".repeat(500) + "b".repeat(100));
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

    expect(document.content).toBe("a".repeat(50));
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

  it("rejects application/pdf as unsupported media type", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("%PDF-1.7...", {
        status: 200,
        headers: { "content-type": "application/pdf" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "unsupported_media_type"
    });
  });

  it("rejects application/octet-stream with a NUL byte as unsupported media type", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(new Uint8Array([104, 105, 0, 101]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      });
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "unsupported_media_type"
    });
  });

  it("rejects a missing header with NUL bytes as unsupported media type", async () => {
    const fetchFn: typeof fetch = async () => new Response(new Uint8Array([78, 0, 97, 0, 109, 0, 101]));
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "unsupported_media_type"
    });
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

    expect(document.content).toContain("Hello");
  });

  it("accepts application/json content type", async () => {
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

    expect(document.content).toBe('{"key": "value"}');
  });

  it("accepts clean text with no content-type header", async () => {
    const fetchFn: typeof fetch = async () => new Response("just text, no NUL bytes");
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document.content).toBe("just text, no NUL bytes");
  });

  it("rejects empty body as upstream empty response", async () => {
    const fetchFn: typeof fetch = async () => new Response("   ");
    const provider = new HttpProvider(parseHttpConfig({}), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "empty"
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
