/** Verifies media-type predicates and constants. */
import { describe, expect, it } from "vitest";

import { isTextLike, looksLikeHtml, mediaTypes } from "../../src/shared/media-types.js";

describe("mediaTypes", () => {
  it("exports expected text media type constants", () => {
    expect(mediaTypes.html).toBe("text/html");
    expect(mediaTypes.markdown).toBe("text/markdown");
    expect(mediaTypes.plainText).toBe("text/plain");
    expect(mediaTypes.json).toBe("application/json");
    expect(mediaTypes.xml).toBe("application/xml");
    expect(mediaTypes.xhtml).toBe("application/xhtml+xml");
  });
});

describe("isTextLike", () => {
  it("returns true for text/* types", () => {
    expect(isTextLike("text/html")).toBe(true);
    expect(isTextLike(" Text/HTML ")).toBe(true);
    expect(isTextLike("text/markdown")).toBe(true);
    expect(isTextLike("text/plain")).toBe(true);
    expect(isTextLike("text/css")).toBe(true);
    expect(isTextLike("text/csv")).toBe(true);
  });

  it("returns true for known textual application/* types", () => {
    expect(isTextLike("application/json")).toBe(true);
    expect(isTextLike("application/xml")).toBe(true);
    expect(isTextLike("application/xhtml+xml")).toBe(true);
  });

  it("returns true for +json and +xml structured suffix types", () => {
    expect(isTextLike("application/rss+xml")).toBe(true);
    expect(isTextLike("application/atom+xml")).toBe(true);
    expect(isTextLike("application/vnd.api+json")).toBe(true);
    expect(isTextLike("image/svg+xml")).toBe(true);
  });

  it("returns false for known binary types", () => {
    expect(isTextLike("application/pdf")).toBe(false);
    expect(isTextLike("application/octet-stream")).toBe(false);
    expect(isTextLike("image/png")).toBe(false);
    expect(isTextLike("image/jpeg")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTextLike("")).toBe(false);
  });
});

describe("looksLikeHtml", () => {
  it("returns true for text starting with <html>", () => {
    expect(looksLikeHtml("<html><body>Hello</body></html>")).toBe(true);
  });

  it("returns true for text starting with <!DOCTYPE", () => {
    expect(looksLikeHtml("<!DOCTYPE html>\n<html>")).toBe(true);
  });

  it("returns true with leading whitespace", () => {
    expect(looksLikeHtml("  \n<html>")).toBe(true);
  });

  it("returns false for bare plain text", () => {
    expect(looksLikeHtml("Dummy PDF file")).toBe(false);
  });

  it("returns false for markdown image reference", () => {
    expect(looksLikeHtml("![](https://example.com/img.jpg)")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeHtml("")).toBe(false);
  });

  it("returns true for linkime-type HTML", () => {
    expect(looksLikeHtml('<html style="height: 100%;"><head><meta name="viewport"></head></html>')).toBe(true);
  });

  it("returns false for markdown heading", () => {
    expect(looksLikeHtml("# Hello world\n\nSome text")).toBe(false);
  });
});
