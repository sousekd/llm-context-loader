/** Verifies the mdream content transformer support matrix and conversion. */
import { describe, expect, it } from "vitest";

import { MdreamTransformer } from "../../../../src/builtins/content-transformers/mdream/mdream-transformer.js";
import { InternalError } from "../../../../src/shared/errors.js";
import { mediaTypes } from "../../../../src/shared/media-types.js";
import { createTestLogger } from "../../../helpers/logger.js";

import type { BodyContent } from "../../../../src/contracts/pipeline/context.js";

function makeTransformer(config: { minimal?: boolean; clean?: boolean } = {}) {
  return new MdreamTransformer(
    { minimal: config.minimal ?? false, clean: config.clean ?? true },
    {
      logger: createTestLogger()
    }
  );
}

const markdownRequest = { targetMediaType: mediaTypes.markdown };

describe("MdreamTransformer.supports", () => {
  it("supports HTML and XHTML text bodies targeting markdown", () => {
    const transformer = makeTransformer();
    expect(transformer.supports({ sourceKind: "text", sourceMediaType: "text/html", request: markdownRequest })).toBe(
      true
    );
    expect(
      transformer.supports({ sourceKind: "text", sourceMediaType: "application/xhtml+xml", request: markdownRequest })
    ).toBe(true);
    expect(
      transformer.supports({
        sourceKind: "text",
        sourceMediaType: "text/html; charset=utf-8",
        request: markdownRequest
      })
    ).toBe(true);
  });

  it("rejects non-HTML sources, non-text kinds, and non-markdown targets", () => {
    const transformer = makeTransformer();
    expect(
      transformer.supports({ sourceKind: "text", sourceMediaType: "text/markdown", request: markdownRequest })
    ).toBe(false);
    expect(transformer.supports({ sourceKind: "binary", sourceMediaType: "text/html", request: markdownRequest })).toBe(
      false
    );
    expect(
      transformer.supports({
        sourceKind: "text",
        sourceMediaType: "text/html",
        request: { targetMediaType: "text/html" }
      })
    ).toBe(false);
  });
});

describe("MdreamTransformer.transform", () => {
  const signal = new AbortController().signal;

  it("converts HTML to markdown, resolves relative links via origin, and preserves the title", async () => {
    const transformer = makeTransformer();
    const body: BodyContent = {
      kind: "text",
      mediaType: "text/html",
      content: '<h1>Hello</h1><p>World <a href="/page">link</a></p>',
      title: "Doc"
    };

    const result = await transformer.transform(
      { url: "https://example.com", body, request: markdownRequest },
      { signal }
    );

    expect(result.outcome).toBe("transformed");
    if (result.outcome !== "transformed") throw new Error("Expected transformed outcome");
    expect(result.body.kind).toBe("text");
    if (result.body.kind !== "text") throw new Error("Expected text body");
    expect(result.body.mediaType).toBe(mediaTypes.markdown);
    expect(result.body.title).toBe("Doc");
    expect(result.body.content).toContain("# Hello");
    expect(result.body.content).toContain("](https://example.com");
  });

  it("emits a summary diagnostic and flags empty output", async () => {
    const transformer = makeTransformer();
    const empty = await transformer.transform(
      {
        url: "https://example.com/",
        body: { kind: "text", mediaType: "text/html", content: "<div></div>" },
        request: markdownRequest
      },
      { signal }
    );
    expect(empty.outcome).toBe("transformed");
    if (empty.outcome !== "transformed") throw new Error("Expected transformed outcome");
    expect(empty.diagnostics?.some(diagnostic => diagnostic.code === "empty_output")).toBe(true);
    expect(empty.diagnostics?.some(diagnostic => diagnostic.code === "mdream")).toBe(true);
  });

  it("throws when given a non-text body", async () => {
    const transformer = makeTransformer();
    await expect(
      transformer.transform(
        {
          url: "https://example.com/",
          body: { kind: "binary", mediaType: "application/pdf", bytes: new Uint8Array([1]) },
          request: markdownRequest
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
          body: { kind: "text", mediaType: "text/html", content: "<p>hi</p>" },
          request: markdownRequest
        },
        { signal: controller.signal }
      )
    ).rejects.toBeDefined();
  });
});
