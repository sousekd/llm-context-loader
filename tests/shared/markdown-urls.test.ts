/** Verifies markdown URL extraction, canonicalization, and counting behavior. */
import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  collectCanonicalUrlCounts,
  collectCanonicalUrls,
  extractMarkdownUrls
} from "../../src/shared/markdown-urls.js";

describe("extractMarkdownUrls", () => {
  it("extracts inline links, autolinks, and bare URLs", () => {
    const markdown = [
      "See [docs](https://example.com/docs) and <https://example.com/auto>.",
      "Also visit https://example.com/bare for more."
    ].join("\n");

    expect(extractMarkdownUrls(markdown)).toEqual([
      "https://example.com/docs",
      "https://example.com/auto",
      "https://example.com/bare"
    ]);
  });

  it("extracts inline links with titles and balanced parentheses", () => {
    const markdown = 'See [query](https://example.com/a(b)?z=1 "title") now.';

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/a(b)?z=1"]);
  });

  it("does not double-count URLs already captured inside an inline link or autolink", () => {
    const markdown = "[label](https://example.com/x) and <https://example.com/y>";

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/x", "https://example.com/y"]);
  });

  it("skips URLs inside inline code spans", () => {
    const markdown = "Use `https://example.com/code` carefully but click [here](https://example.com/link).";

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/link"]);
  });

  it("skips URLs inside fenced code blocks", () => {
    const markdown = [
      "before https://example.com/before",
      "```",
      "https://example.com/fenced",
      "```",
      "after https://example.com/after"
    ].join("\n");

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/before", "https://example.com/after"]);
  });

  it("ignores image links and reference definitions", () => {
    const markdown = [
      "![alt](https://example.com/image.png)",
      "",
      "[ref]: https://example.com/reference",
      "",
      "Link [text](https://example.com/inline)."
    ].join("\n");

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/inline"]);
  });

  it("trims trailing punctuation from bare URLs", () => {
    const markdown = "See (https://example.com/path), and https://example.com/other.";

    expect(extractMarkdownUrls(markdown)).toEqual(["https://example.com/path", "https://example.com/other"]);
  });

  it("returns an empty list when no URLs are present", () => {
    expect(extractMarkdownUrls("Just some prose without links.")).toEqual([]);
  });
});

describe("canonicalizeUrl", () => {
  it("produces the same canonical key regardless of query parameter order", () => {
    const left = canonicalizeUrl("https://example.com/path?b=2&a=1");
    const right = canonicalizeUrl("https://example.com/path?a=1&b=2");

    expect(left).toBeDefined();
    expect(left).toBe(right);
  });

  it("strips fragments and lowercases the host", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com/path#section")).toBe("https://example.com/path");
  });

  it("rejects non-http(s) and unparseable URLs", () => {
    expect(canonicalizeUrl("ftp://example.com")).toBeUndefined();
    expect(canonicalizeUrl("mailto:user@example.com")).toBeUndefined();
    expect(canonicalizeUrl("not a url")).toBeUndefined();
    expect(canonicalizeUrl("")).toBeUndefined();
  });

  it("decodes common HTML entities before parsing", () => {
    expect(canonicalizeUrl("https://example.com/path?a=1&amp;b=2")).toBe("https://example.com/path?a=1&b=2");
  });

  it("preserves repeated query keys while sorting by key and value", () => {
    expect(canonicalizeUrl("https://example.com/path?b=2&a=2&a=1")).toBe("https://example.com/path?a=1&a=2&b=2");
  });
});

describe("collectCanonicalUrls", () => {
  it("extracts, canonicalizes, and deduplicates URLs from markdown", () => {
    const markdown = [
      "[one](https://EXAMPLE.com/path?b=2&a=1)",
      "Also https://example.com/path?a=1&b=2 and <https://example.com/other>"
    ].join("\n");

    const set = collectCanonicalUrls(markdown);

    expect([...set].sort()).toEqual(["https://example.com/other", "https://example.com/path?a=1&b=2"]);
  });

  it("drops URLs that cannot be canonicalized", () => {
    const markdown = "Click [bad](ftp://example.com/x) or [good](https://example.com/y).";

    expect([...collectCanonicalUrls(markdown)]).toEqual(["https://example.com/y"]);
  });
});

describe("collectCanonicalUrlCounts", () => {
  it("counts occurrences per canonical URL across link forms", () => {
    const markdown = [
      "[one](https://example.com/x)",
      "Also https://example.com/x and <https://example.com/x>",
      "[other](https://example.com/y)"
    ].join("\n");

    const counts = collectCanonicalUrlCounts(markdown);

    expect(counts.get("https://example.com/x")).toBe(3);
    expect(counts.get("https://example.com/y")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("collapses host-case and query-order variants into one canonical key", () => {
    const markdown = ["[a](https://EXAMPLE.com/path?b=2&a=1)", "[b](https://example.com/path?a=1&b=2#frag)"].join("\n");

    const counts = collectCanonicalUrlCounts(markdown);

    expect(counts.size).toBe(1);
    expect(counts.get("https://example.com/path?a=1&b=2")).toBe(2);
  });

  it("returns an empty map when no canonical URLs are found", () => {
    expect(collectCanonicalUrlCounts("just prose").size).toBe(0);
  });
});
