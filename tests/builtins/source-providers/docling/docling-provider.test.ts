/** Verifies Docling source-provider request, response, and failure behavior. */
import { describe, expect, it } from "vitest";

import { UpstreamError } from "../../../../src/shared/errors.js";
import { parseDoclingConfig } from "../../../../src/builtins/source-providers/docling/docling-provider-config.js";
import { DoclingProvider } from "../../../../src/builtins/source-providers/docling/docling-provider.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { jsonResponse } from "../../../helpers/responses.js";

describe("DoclingProvider", () => {
  it("sends the convert request and returns markdown content", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      requestBody = JSON.parse(String(init?.body));
      expect(String(input)).toBe("http://docling.example/v1/convert/source");
      expect(init?.method).toBe("POST");
      return jsonResponse({
        document: { md_content: "# hello", json_content: { name: "Hello" } },
        status: "success",
        processing_time: 0.5
      });
    };
    const provider = new DoclingProvider(
      parseDoclingConfig({ baseUrl: "http://docling.example", options: { do_ocr: false, table_mode: "fast" } }),
      { httpFetch: fetchFn, logger: createTestLogger() }
    );

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody).toEqual({
      sources: [{ kind: "http", url: "https://example.com" }],
      options: {
        do_ocr: false,
        table_mode: "fast",
        to_formats: ["md", "json"]
      }
    });
    expect(document).toEqual({ kind: "text", content: "# hello", mediaType: "text/markdown", title: "Hello" });
  });

  it("returns html content when output is html", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        document: { html_content: "<p>Hello</p>", json_content: { name: "Hello" } },
        status: "success",
        processing_time: 0.5
      });
    };
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example", output: "html" }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody).toMatchObject({
      options: { to_formats: ["html", "json"] }
    });
    expect(document).toEqual({ kind: "text", content: "<p>Hello</p>", mediaType: "text/html", title: "Hello" });
  });

  it("passes opaque options but keeps to_formats provider-managed", async () => {
    let requestBody: { options?: Record<string, unknown> } | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ document: { md_content: "# ok" }, status: "success", processing_time: 0.5 });
    };
    const provider = new DoclingProvider(
      parseDoclingConfig({
        baseUrl: "http://docling.example",
        options: { image_export_mode: "embedded", force_ocr: true, to_formats: ["html"] }
      }),
      { httpFetch: fetchFn, logger: createTestLogger() }
    );

    await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(requestBody?.options).toEqual({
      image_export_mode: "embedded",
      force_ocr: true,
      to_formats: ["md", "json"]
    });
  });

  it("accepts partial_success status and missing title", async () => {
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: async () =>
        jsonResponse({
          document: { md_content: "# ok", json_content: null },
          status: "partial_success",
          processing_time: 1.0
        }),
      logger: createTestLogger()
    });

    const document = await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(document).toEqual({ kind: "text", content: "# ok", mediaType: "text/markdown" });
  });

  it("omits title when json_content.name is missing or empty", async () => {
    const noName = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: async () =>
        jsonResponse({
          document: { md_content: "content", json_content: {} },
          status: "success",
          processing_time: 0.5
        }),
      logger: createTestLogger()
    });
    const emptyName = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: async () =>
        jsonResponse({
          document: { md_content: "content", json_content: { name: "" } },
          status: "success",
          processing_time: 0.5
        }),
      logger: createTestLogger()
    });

    await expect(noName.load("https://example.com", { signal: new AbortController().signal })).resolves.toEqual({
      kind: "text",
      content: "content",
      mediaType: "text/markdown"
    });
    await expect(emptyName.load("https://example.com", { signal: new AbortController().signal })).resolves.toEqual({
      kind: "text",
      content: "content",
      mediaType: "text/markdown"
    });
  });

  it("sends X-Api-Key header when an API key is configured", async () => {
    let headers: Record<string, string> | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      headers = init?.headers as Record<string, string>;
      return jsonResponse({
        document: { md_content: "ok" },
        status: "success",
        processing_time: 0.5
      });
    };
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example", apiKey: "dl-key" }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await provider.load("https://example.com", { signal: new AbortController().signal });

    expect(headers?.["x-api-key"]).toBe("dl-key");
  });

  it("preserves sanitized upstream codes from failed status", async () => {
    const fetchFn: typeof fetch = async () =>
      jsonResponse(
        {
          document: { md_content: null },
          status: "failure",
          errors: [{ error_message: "model timed out" }],
          processing_time: 5.0
        },
        { status: 200 }
      );
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: fetchFn,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "failure",
      upstreamStatus: 200
    });
  });

  it("rejects empty content as an upstream empty response for any output", async () => {
    const mdProvider = new DoclingProvider(
      parseDoclingConfig({ baseUrl: "http://docling.example", output: "markdown" }),
      {
        httpFetch: async () =>
          jsonResponse({
            document: { md_content: "   " },
            status: "success",
            processing_time: 0.5
          }),
        logger: createTestLogger()
      }
    );
    const htmlProvider = new DoclingProvider(
      parseDoclingConfig({ baseUrl: "http://docling.example", output: "html" }),
      {
        httpFetch: async () =>
          jsonResponse({
            document: { html_content: "   " },
            status: "success",
            processing_time: 0.5
          }),
        logger: createTestLogger()
      }
    );

    await expect(
      mdProvider.load("https://example.com", { signal: new AbortController().signal })
    ).rejects.toMatchObject({
      upstreamCode: "empty"
    });
    await expect(
      htmlProvider.load("https://example.com", { signal: new AbortController().signal })
    ).rejects.toMatchObject({
      upstreamCode: "empty"
    });
  });

  it("wraps non-JSON and network failures as UpstreamError", async () => {
    const nonJson = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: async () => new Response("<html></html>", { status: 200 }),
      logger: createTestLogger()
    });
    await expect(nonJson.load("https://example.com", { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "parse_error"
    });

    const network = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
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
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
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
    const response = jsonResponse({ document: { md_content: "ok" }, status: "success", processing_time: 0.5 });
    Object.defineProperty(response, "json", { value: async () => Promise.reject(abort) });
    const provider = new DoclingProvider(parseDoclingConfig({ baseUrl: "http://docling.example" }), {
      httpFetch: async () => response,
      logger: createTestLogger()
    });

    await expect(provider.load("https://example.com", { signal: new AbortController().signal })).rejects.toBe(abort);
  });
});
