import { describe, expect, it } from "vitest";

import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";
import { buildTrustedUrlInventory } from "../../../src/tools/url-reconciler/inventory.js";
import { matchByDeterministicRepair } from "../../../src/tools/url-reconciler/match-deterministic.js";

function inventory(markdown: string) {
  return buildTrustedUrlInventory(extractMarkdownUrls(markdown));
}

describe("matchByDeterministicRepair", () => {
  it("returns a single match", () => {
    const [candidate] = extractMarkdownUrls("[A](<https://example.com/a>)");
    const result = matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a)"));

    expect(result).toMatchObject({ kind: "match", record: { rawUrl: "https://example.com/a" } });
  });

  it("returns none when no candidate lands on trusted URLs", () => {
    const [candidate] = extractMarkdownUrls("[A](https://missing.example/a)");

    expect(matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a)")).kind).toBe("none");
  });

  it("returns ambiguous when fetch-level matching finds multiple trusted fragments", () => {
    const [candidate] = extractMarkdownUrls("[A](https://example.com/a)");
    const result = matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a#one) [B](https://example.com/a#two)"));

    expect(result).toMatchObject({ kind: "ambiguous" });
  });

  it("matches entity-encoded candidates", () => {
    const [candidate] = extractMarkdownUrls("[A](https://example.com/a?x=1&amp;y=2)");

    expect(matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a?x=1&y=2)")).kind).toBe("match");
  });

  it("matches wrapper-wrapped candidates", () => {
    const [candidate] = extractMarkdownUrls('[A]("https://example.com/a")');

    expect(matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a)")).kind).toBe("match");
  });

  it("matches trailing punctuation candidates", () => {
    const [candidate] = extractMarkdownUrls("[A](https://example.com/a,)");

    expect(matchByDeterministicRepair(candidate, inventory("[A](https://example.com/a)")).kind).toBe("match");
  });

  it("collapses trusted records that share a strict normalized key but differ in raw form", () => {
    const [candidate] = extractMarkdownUrls("[A](https://example.com/a)");
    const result = matchByDeterministicRepair(
      candidate,
      inventory("[A](https://EXAMPLE.com/a) [B](https://example.com/a)")
    );

    expect(result.kind).toBe("match");
  });
});

