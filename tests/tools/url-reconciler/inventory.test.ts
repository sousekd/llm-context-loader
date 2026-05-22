import { describe, expect, it } from "vitest";

import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";
import { buildTrustedUrlInventory } from "../../../src/tools/url-reconciler/inventory.js";

describe("buildTrustedUrlInventory", () => {
  it("populates raw, strict, and fetch lookup tiers", () => {
    const records = extractMarkdownUrls("[A](https://example.com/a#frag)");
    const inventory = buildTrustedUrlInventory(records);

    expect(inventory.lookupRaw("https://example.com/a#frag")).toHaveLength(1);
    expect(inventory.lookupStrict("https://example.com/a#frag")).toHaveLength(1);
    expect(inventory.lookupFetch("https://example.com/a")).toHaveLength(1);
  });

  it("deduplicates by raw URL", () => {
    const records = extractMarkdownUrls("[A](https://example.com/a) [B](https://example.com/a)");
    const inventory = buildTrustedUrlInventory(records);

    expect(inventory.allRecords()).toHaveLength(1);
  });

  it("indexes later anchor text for duplicate raw URLs", () => {
    const records = extractMarkdownUrls("[A](https://example.com/a) [B](https://example.com/a)");
    const inventory = buildTrustedUrlInventory(records);

    expect(inventory.lookupAnchorText("A")).toHaveLength(1);
    expect(inventory.lookupAnchorText("B")).toHaveLength(1);
  });

  it("indexes records with anchor text", () => {
    const inventory = buildTrustedUrlInventory(extractMarkdownUrls("[Docs](https://example.com/docs) https://example.com/bare"));

    expect(inventory.lookupAnchorText("Docs")).toHaveLength(1);
    expect(inventory.lookupAnchorText("missing")).toHaveLength(0);
  });

  it("normalizes anchor text whitespace", () => {
    const inventory = buildTrustedUrlInventory(extractMarkdownUrls("[Docs   Page](https://example.com/docs)"));

    expect(inventory.lookupAnchorText("Docs Page")).toHaveLength(1);
  });

  it("groups records across hosts by path", () => {
    const inventory = buildTrustedUrlInventory(extractMarkdownUrls("https://a.example/same https://b.example/same"));

    expect(inventory.lookupByHostPath("/same")).toHaveLength(2);
  });

  it("handles trailing slash path variants", () => {
    const inventory = buildTrustedUrlInventory(extractMarkdownUrls("https://example.com/same/"));

    expect(inventory.lookupByHostPath("/same")).toHaveLength(1);
  });

  it("skips invalid trusted URLs", () => {
    const inventory = buildTrustedUrlInventory(extractMarkdownUrls("[bad](/relative)"));

    expect(inventory.allRecords()).toEqual([]);
  });

  it("handles an empty trusted document", () => {
    const inventory = buildTrustedUrlInventory([]);

    expect(inventory.allRecords()).toEqual([]);
    expect(inventory.lookupRaw("https://example.com")).toEqual([]);
  });
});
