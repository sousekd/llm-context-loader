import { describe, expect, it } from "vitest";

import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";
import { buildTrustedUrlInventory } from "../../../src/tools/url-reconciler/inventory.js";
import { matchByHostTypo } from "../../../src/tools/url-reconciler/match-host-typo.js";

function inventory(markdown: string) {
  return buildTrustedUrlInventory(extractMarkdownUrls(markdown));
}

function match(candidateMarkdown: string, trustedMarkdown: string) {
  const [candidate] = extractMarkdownUrls(candidateMarkdown);
  return matchByHostTypo(candidate, inventory(trustedMarkdown), { maxEditDistance: 1, maxEditDistanceRatio: 0.1 });
}

describe("matchByHostTypo", () => {
  it("matches a single host typo with exact path agreement", () => {
    expect(match("https://bcc.com/news/x", "https://bbc.com/news/x")).toMatchObject({ kind: "match", record: { rawUrl: "https://bbc.com/news/x" } });
  });

  it("refuses path disagreement", () => {
    expect(match("https://bcc.com/news/y", "https://bbc.com/news/x").kind).toBe("none");
  });

  it("refuses query disagreement", () => {
    expect(match("https://bcc.com/news/x?a=1", "https://bbc.com/news/x?a=2").kind).toBe("none");
  });

  it("accepts query order differences", () => {
    expect(match("https://bcc.com/news/x?b=2&a=1", "https://bbc.com/news/x?a=1&b=2").kind).toBe("match");
  });

  it("refuses scheme disagreement", () => {
    expect(match("http://bcc.com/news/x", "https://bbc.com/news/x").kind).toBe("none");
  });

  it("refuses distances beyond the budget", () => {
    expect(match("https://totally-wrong.example/news/x", "https://bbc.com/news/x").kind).toBe("none");
  });

  it("returns ambiguous when two trusted hosts qualify", () => {
    const result = match("https://bbc.com/news/x", "https://abc.com/news/x https://bbc1.com/news/x");

    expect(result).toMatchObject({ kind: "ambiguous" });
  });

  it("tolerates trailing slash differences in paths", () => {
    expect(match("https://bcc.com/news/x/", "https://bbc.com/news/x").kind).toBe("match");
  });

  it("uses ratio budget for long hosts", () => {
    const [candidate] = extractMarkdownUrls("https://documentation.exampel.com/a");
    const result = matchByHostTypo(candidate, inventory("https://documentation.example.com/a"), { maxEditDistance: 0, maxEditDistanceRatio: 0.1 });

    expect(result.kind).toBe("match");
  });

  it("uses absolute budget for short hosts", () => {
    expect(match("https://b.com/a", "https://a.com/a").kind).toBe("match");
  });

  it("does not match identical hosts", () => {
    expect(match("https://bbc.com/news/x", "https://bbc.com/news/x").kind).toBe("none");
  });

  it("returns none for parse failures", () => {
    const [candidate] = extractMarkdownUrls("[bad](/relative)");

    expect(matchByHostTypo(candidate, inventory("https://bbc.com/news/x"), { maxEditDistance: 1, maxEditDistanceRatio: 0.1 }).kind).toBe("none");
  });
});
