import { describe, expect, it } from "vitest";

import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";

describe("extractMarkdownUrls", () => {
  it("extracts inline links with exact URL spans", () => {
    const markdown = "Read [BBC News](https://www.bbc.com/news/article).";
    const [link] = extractMarkdownUrls(markdown);

    expect(link).toMatchObject({ kind: "inline", rawUrl: "https://www.bbc.com/news/article", text: "BBC News" });
    expect(markdown.slice(link.urlStart, link.urlEnd)).toBe(link.rawUrl);
  });

  it("extracts images when enabled by default", () => {
    const [image] = extractMarkdownUrls("![Alt](https://img.example/a.png)");

    expect(image).toMatchObject({ kind: "image", rawUrl: "https://img.example/a.png", text: "Alt" });
  });

  it("can skip images", () => {
    expect(extractMarkdownUrls("![Alt](https://img.example/a.png)", { includeImages: false })).toEqual([]);
  });

  it("extracts reference definitions", () => {
    const [reference] = extractMarkdownUrls("[docs]: https://docs.example/path \"Docs\"");

    expect(reference).toMatchObject({ kind: "reference_definition", rawUrl: "https://docs.example/path", text: "docs" });
  });

  it("extracts autolinks", () => {
    const [autolink] = extractMarkdownUrls("See <https://example.com/a> now.");

    expect(autolink).toMatchObject({ kind: "autolink", rawUrl: "https://example.com/a" });
  });

  it("extracts bare URLs and trims prose punctuation", () => {
    const [bare] = extractMarkdownUrls("See https://example.com/a?b=1, please.");

    expect(bare).toMatchObject({ kind: "bare", rawUrl: "https://example.com/a?b=1" });
  });

  it("preserves balanced parentheses in bare URLs", () => {
    const [bare] = extractMarkdownUrls("See https://example.com/wiki/Foo_(bar). Good.");

    expect(bare.rawUrl).toBe("https://example.com/wiki/Foo_(bar)");
  });

  it("skips fenced code blocks", () => {
    const markdown = "```ts\nhttps://bad.example\n```\nhttps://good.example";
    const urls = extractMarkdownUrls(markdown);

    expect(urls.map((url) => url.rawUrl)).toEqual(["https://good.example"]);
  });

  it("does not treat fence-like code lines with trailing text as closers", () => {
    const markdown = "```ts\n```not a closer\nhttps://bad.example\n```\nhttps://good.example";

    expect(extractMarkdownUrls(markdown).map((url) => url.rawUrl)).toEqual(["https://good.example"]);
  });

  it("skips tilde fences", () => {
    const markdown = "~~~\nhttps://bad.example\n~~~\n[ok](https://good.example)";

    expect(extractMarkdownUrls(markdown).map((url) => url.rawUrl)).toEqual(["https://good.example"]);
  });

  it("skips inline code spans", () => {
    const markdown = "Use `https://bad.example` and ``https://also-bad.example`` then https://good.example";

    expect(extractMarkdownUrls(markdown).map((url) => url.rawUrl)).toEqual(["https://good.example"]);
  });

  it("handles CRLF input", () => {
    const urls = extractMarkdownUrls("[a]: https://a.example\r\n[b](https://b.example)");

    expect(urls.map((url) => url.rawUrl)).toEqual(["https://a.example", "https://b.example"]);
  });

  it("extracts IDN and IPv6 literal URLs", () => {
    const urls = extractMarkdownUrls("https://muenich.example/ and http://[::1]:8080/a");

    expect(urls.map((url) => url.rawUrl)).toEqual(["https://muenich.example/", "http://[::1]:8080/a"]);
  });

  it("rejects multi-line inline link destinations", () => {
    expect(extractMarkdownUrls("[bad](https://example.com/\npath)")).toEqual([]);
  });

  it("handles escaped parentheses in inline link destinations", () => {
    const [link] = extractMarkdownUrls("[docs](https://example.com/a\\)b)");

    expect(link).toMatchObject({ kind: "inline", rawUrl: "https://example.com/a\\)b" });
  });

  it("keeps simple bracketed link text intact", () => {
    const urls = extractMarkdownUrls("[[nested]](https://example.com)");

    expect(urls[0]?.text).toBe("[nested]");
  });
});
