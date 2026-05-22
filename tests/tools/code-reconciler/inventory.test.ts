import { describe, expect, it } from "vitest";

import { extractMarkdownCodeBlocks } from "../../../src/tools/code-reconciler/extract.js";
import { buildTrustedCodeBlockInventory } from "../../../src/tools/code-reconciler/inventory.js";

describe("buildTrustedCodeBlockInventory", () => {
  it("populates raw and normalized lookup tiers", () => {
    const [block] = extractMarkdownCodeBlocks("```ts\nconst x = 1;  \n```");
    const inventory = buildTrustedCodeBlockInventory([block], { trimTrailingLineWs: true });

    expect(inventory.lookupRawBlock(block.rawBlock)).toHaveLength(1);
    expect(inventory.lookupRawCode(block.rawCode)).toHaveLength(1);
    expect(inventory.lookupNormalizedCode("const x = 1;\n")).toHaveLength(1);
  });

  it("deduplicates by raw block", () => {
    const [block] = extractMarkdownCodeBlocks("```ts\nconst x = 1;\n```");
    const inventory = buildTrustedCodeBlockInventory([block, block]);

    expect(inventory.allRecords()).toHaveLength(1);
  });

  it("indexes records by normalized language", () => {
    const inventory = buildTrustedCodeBlockInventory(extractMarkdownCodeBlocks("```ts\nconst x = 1;\n```"));

    expect(inventory.lookupByLanguage("typescript")).toHaveLength(1);
    expect(inventory.lookupByLanguage("TS")).toHaveLength(1);
    expect(inventory.lookupByLanguage("missing")).toHaveLength(0);
  });

  it("handles an empty trusted document", () => {
    const inventory = buildTrustedCodeBlockInventory([]);

    expect(inventory.allRecords()).toEqual([]);
    expect(inventory.lookupRawBlock("``````")).toEqual([]);
  });
});
