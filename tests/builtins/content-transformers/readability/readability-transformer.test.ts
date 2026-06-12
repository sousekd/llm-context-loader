/** Verifies the readability content transformer support matrix, decline behavior, and conversion. */
import { describe, expect, it } from "vitest";

import { ReadabilityTransformer } from "../../../../src/builtins/content-transformers/readability/readability-transformer.js";
import { InternalError } from "../../../../src/shared/errors.js";
import { mediaTypes } from "../../../../src/shared/media-types.js";
import { createTestLogger } from "../../../helpers/logger.js";

import type { BodyContent } from "../../../../src/contracts/pipeline/context.js";

function articleHtml(title?: string): string {
  const header = title ? `<title>${title}</title>` : "";
  return `<html><head>${header}</head><body><article><h1>Article</h1><p>${"Article content paragraph. ".repeat(60)}</p></article></body></html>`;
}

function shortHtml(): string {
  return "<html><body><p>Too short</p></body></html>";
}

function makeTransformer(config: { minContentLength?: number; minScore?: number; maxElements?: number } = {}) {
  return new ReadabilityTransformer(
    {
      minContentLength: config.minContentLength ?? 140,
      minScore: config.minScore ?? 20,
      maxElements: config.maxElements ?? 0
    },
    { logger: createTestLogger() }
  );
}

const htmlRequest = { targetMediaType: mediaTypes.html };

describe("ReadabilityTransformer.supports", () => {
  it("supports HTML and XHTML text bodies targeting HTML", () => {
    const transformer = makeTransformer();
    expect(transformer.supports({ sourceKind: "text", sourceMediaType: "text/html", request: htmlRequest })).toBe(true);
    expect(
      transformer.supports({ sourceKind: "text", sourceMediaType: "application/xhtml+xml", request: htmlRequest })
    ).toBe(true);
  });

  it("rejects non-HTML sources, non-text kinds, and non-HTML targets", () => {
    const transformer = makeTransformer();
    expect(transformer.supports({ sourceKind: "text", sourceMediaType: "text/plain", request: htmlRequest })).toBe(
      false
    );
    expect(transformer.supports({ sourceKind: "binary", sourceMediaType: "text/html", request: htmlRequest })).toBe(
      false
    );
    expect(
      transformer.supports({
        sourceKind: "text",
        sourceMediaType: "text/html",
        request: { targetMediaType: "text/markdown" }
      })
    ).toBe(false);
  });
});

describe("ReadabilityTransformer.transform", () => {
  const signal = new AbortController().signal;

  it("extracts article content from readerable HTML", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: articleHtml("Test Page"),
      title: "Original Title"
    };

    const result = await transformer.transform({ url: "https://example.com", body, request: htmlRequest }, { signal });

    expect(result.outcome).toBe("transformed");
    if (result.outcome !== "transformed") return;
    expect(result.body.kind).toBe("text");
    if (result.body.kind !== "text") return;
    expect(result.body.mediaType).toBe(mediaTypes.html);
    expect(result.body.content).toContain("Article content");
    expect(result.body.title).toBe("Original Title");
  });

  it("falls back to the article title when the incoming body has no title", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: articleHtml("Page Title")
    };

    const result = await transformer.transform({ url: "https://example.com", body, request: htmlRequest }, { signal });

    expect(result.outcome).toBe("transformed");
    if (result.outcome !== "transformed") return;
    expect(result.body.title).toBe("Page Title");
  });

  it("transforms article HTML without diagnostics", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: articleHtml()
    };

    const result = await transformer.transform({ url: "https://example.com", body, request: htmlRequest }, { signal });

    expect(result.outcome).toBe("transformed");
    if (result.outcome !== "transformed") return;
    expect(result.diagnostics).toBeUndefined();
  });

  it("declines not_readerable for short boilerplate HTML", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: shortHtml()
    };

    const result = await transformer.transform({ url: "https://example.com", body, request: htmlRequest }, { signal });

    expect(result.outcome).toBe("declined");
    if (result.outcome !== "declined") return;
    expect(result.reason).toBe("not_readerable");
  });

  it("declines parse_empty for a document with no document element", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: ""
    };

    const result = await transformer.transform({ url: "https://example.com", body, request: htmlRequest }, { signal });

    expect(result.outcome).toBe("declined");
    if (result.outcome !== "declined") return;
    expect(result.reason).toBe("parse_empty");
  });

  it("throws when given a non-text body", async () => {
    const transformer = makeTransformer();
    await expect(
      transformer.transform(
        {
          url: "https://example.com/",
          body: { kind: "binary", mediaType: "application/pdf", bytes: new Uint8Array([1]) },
          request: htmlRequest
        },
        { signal }
      )
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("throws if the signal is already aborted", async () => {
    const transformer = makeTransformer();
    const controller = new AbortController();
    controller.abort();
    await expect(
      transformer.transform(
        {
          url: "https://example.com/",
          body: { kind: "text", mediaType: "text/html", content: articleHtml() },
          request: htmlRequest
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow();
  });
});
