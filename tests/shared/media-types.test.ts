/** Verifies media-type predicates and constants. */
import { describe, expect, it } from "vitest";

import { isTextLike, mediaTypes } from "../../src/shared/media-types.js";

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
