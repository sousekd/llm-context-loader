import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchResult } from "../../../src/tools/shared/match-result.js";
import type { TrustedCodeBlockInventory, TrustedCodeBlockRecord } from "../../../src/tools/code-reconciler/types.js";

import { applySpanPatches, type SpanPatch } from "../../../src/tools/shared/apply-span-patches.js";
import { extractMarkdownCodeBlocks } from "../../../src/tools/code-reconciler/extract.js";
import { buildTrustedCodeBlockInventory } from "../../../src/tools/code-reconciler/inventory.js";
import { matchByNormalizedCode } from "../../../src/tools/code-reconciler/match-normalized-code.js";
import { matchByRawBlock } from "../../../src/tools/code-reconciler/match-raw-block.js";
import { matchByRawCode } from "../../../src/tools/code-reconciler/match-raw-code.js";

const fixtures = join(process.cwd(), "tests", "tools", "code-reconciler", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8").replace(/\r\n/g, "\n");
}

function firstMatch(results: readonly MatchResult<TrustedCodeBlockRecord>[]): MatchResult<TrustedCodeBlockRecord> {
  return results.find((result) => result.kind === "match") ?? { kind: "none" };
}

function repairCodeBlocks(candidate: string, inventory: TrustedCodeBlockInventory): { markdown: string; replaced: number } {
  const patches: SpanPatch[] = [];
  let replaced = 0;

  for (const block of extractMarkdownCodeBlocks(candidate)) {
    const result = firstMatch([
      matchByRawBlock(block, inventory),
      matchByRawCode(block, inventory),
      matchByNormalizedCode(block, inventory, NORMALIZE_OPTIONS)
    ]);
    if (result.kind === "match" && result.record.extracted.rawBlock !== block.rawBlock) {
      patches.push({ start: block.start, end: block.end, replacement: result.record.extracted.rawBlock });
      replaced += 1;
    }
  }

  return { markdown: applySpanPatches(candidate, patches), replaced };
}

const NORMALIZE_OPTIONS = { trimTrailingLineWs: true, trimFinalNewline: true } as const;

describe("code-block reconciliation primitives", () => {
  it("repairs a fence-style change by copying the trusted raw block byte-for-byte", () => {
    const trusted = "Intro\n```ts\nconst x = 1;\n```\nOutro";
    const candidate = "Intro\n~~~ts\nconst x = 1;\n~~~\nOutro";
    const [candidateBlock] = extractMarkdownCodeBlocks(candidate);
    const result = matchByRawCode(candidateBlock, buildTrustedCodeBlockInventory(extractMarkdownCodeBlocks(trusted)));

    if (result.kind !== "match") throw new Error("Expected a match");

    const repaired = applySpanPatches(candidate, [{ start: candidateBlock.start, end: candidateBlock.end, replacement: result.record.extracted.rawBlock }]);
    expect(repaired).toBe(trusted);
  });

  it("leaves a truncated candidate fence unavailable for repair", () => {
    const candidate = "Intro\n```ts\nconst x = 1;\nOutro";

    expect(extractMarkdownCodeBlocks(candidate)).toEqual([]);
  });

  it("repairs a multi-block fixture while preserving prose and unmatched candidates", () => {
    const trusted = fixture("multi-block.trusted.md");
    const candidate = fixture("multi-block.candidate.md");
    const inventory = buildTrustedCodeBlockInventory(extractMarkdownCodeBlocks(trusted), NORMALIZE_OPTIONS);
    const result = repairCodeBlocks(candidate, inventory);

    expect(result.replaced).toBe(2);
    expect(result.markdown).toContain("```ts\nexport function add(left: number, right: number): number {\n  return left + right;\n}\n```");
    expect(result.markdown).toContain("```sh\necho \"trusted\"\n```");
    expect(result.markdown).toContain("```py\ndef greet(name: str) -> str:\n    return f\"hello, {name}\"\n```");
    expect(result.markdown).toContain("```js\nconsole.log(\"only in candidate\");\n```");
    expect(result.markdown).toContain("Intro paragraph that should be left untouched.");
  });

  it("is deterministic across repeated runs", () => {
    const trusted = fixture("multi-block.trusted.md");
    const candidate = fixture("multi-block.candidate.md");
    const inventory = buildTrustedCodeBlockInventory(extractMarkdownCodeBlocks(trusted), NORMALIZE_OPTIONS);

    expect(repairCodeBlocks(candidate, inventory)).toEqual(repairCodeBlocks(candidate, inventory));
  });
});

