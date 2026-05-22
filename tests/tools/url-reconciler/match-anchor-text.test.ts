import { describe, expect, it } from "vitest";

import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";
import { buildTrustedUrlInventory } from "../../../src/tools/url-reconciler/inventory.js";
import { matchByAnchorText } from "../../../src/tools/url-reconciler/match-anchor-text.js";

function inventory(markdown: string) {
  return buildTrustedUrlInventory(extractMarkdownUrls(markdown));
}

describe("matchByAnchorText", () => {
  it("matches unique anchor text when the candidate URL is broken", () => {
    const [candidate] = extractMarkdownUrls("[BBC News](https://bcc.com/news/article)");
    const result = matchByAnchorText(candidate, inventory("[BBC News](https://bbc.com/news/article)"));

    expect(result).toMatchObject({ kind: "match", record: { rawUrl: "https://bbc.com/news/article" } });
  });

  it("matches valid candidate URLs on the trusted domain by default (no filter)", () => {
    const [candidate] = extractMarkdownUrls("[BBC News](https://bbc.com/other)");

    expect(matchByAnchorText(candidate, inventory("[BBC News](https://bbc.com/news/article)")).kind).toBe("match");
  });

  it("returns ambiguous for duplicate anchor text", () => {
    const [candidate] = extractMarkdownUrls("[Docs](https://wrong.example/docs)");
    const result = matchByAnchorText(candidate, inventory("[Docs](https://a.example/docs) [Docs](https://b.example/docs)"));

    expect(result).toMatchObject({ kind: "ambiguous" });
  });

  it("returns none when anchor text is absent from trusted URLs", () => {
    const [candidate] = extractMarkdownUrls("[Missing](https://wrong.example/docs)");

    expect(matchByAnchorText(candidate, inventory("[Docs](https://a.example/docs)")).kind).toBe("none");
  });

  it("does not match empty anchor text", () => {
    const [candidate] = extractMarkdownUrls("[](https://wrong.example/docs)");

    expect(matchByAnchorText(candidate, inventory("[](https://a.example/docs)")).kind).toBe("none");
  });

  it("applies a caller-supplied filter predicate", () => {
    const [candidate] = extractMarkdownUrls("[Docs](https://example.com/old)");
    const filter = (cand: typeof candidate, record: { rawUrl: string }) => !record.rawUrl.startsWith("https://example.com/");

    expect(matchByAnchorText(candidate, inventory("[Docs](https://example.com/new)"), { filter }).kind).toBe("none");
  });

  it("matches reference definition candidates", () => {
    const [candidate] = extractMarkdownUrls("[docs]: https://wrong.example/docs");

    expect(matchByAnchorText(candidate, inventory("[docs]: https://example.com/docs")).kind).toBe("match");
  });

  it("returns none for bare URL candidates", () => {
    const [candidate] = extractMarkdownUrls("https://wrong.example/docs");

    expect(matchByAnchorText(candidate, inventory("[docs](https://example.com/docs)")).kind).toBe("none");
  });
});

