import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applySpanPatches, type SpanPatch } from "../../../src/tools/shared/apply-span-patches.js";
import type { MatchResult } from "../../../src/tools/shared/match-result.js";
import { extractMarkdownUrls } from "../../../src/tools/url-reconciler/extract.js";
import { buildTrustedUrlInventory } from "../../../src/tools/url-reconciler/inventory.js";
import { matchByAnchorText } from "../../../src/tools/url-reconciler/match-anchor-text.js";
import { matchByDeterministicRepair } from "../../../src/tools/url-reconciler/match-deterministic.js";
import { matchByHostTypo } from "../../../src/tools/url-reconciler/match-host-typo.js";
import { normalizeUrlForComparison } from "../../../src/tools/url-reconciler/normalize.js";
import type { ExtractedMarkdownUrl, TrustedUrlInventory, TrustedUrlRecord } from "../../../src/tools/url-reconciler/types.js";

interface RepairResult {
  readonly markdown: string;
  readonly replacements: readonly string[];
}

const fixtures = join(process.cwd(), "tests", "tools", "url-reconciler", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

function repairMarkdown(candidateMarkdown: string, trustedMarkdown: string): RepairResult {
  const inventory = buildTrustedUrlInventory(extractMarkdownUrls(trustedMarkdown));
  const patches: SpanPatch[] = [];
  const replacements: string[] = [];

  for (const candidate of extractMarkdownUrls(candidateMarkdown)) {
    const result = firstMatch([
      matchByExactOrNormalized(candidate, inventory),
      matchByDeterministicRepair(candidate, inventory),
      matchByAnchorText(candidate, inventory),
      matchByHostTypo(candidate, inventory, { maxEditDistance: 1, maxEditDistanceRatio: 0.1 })
    ]);

    if (result.kind === "match" && result.record.rawUrl !== candidate.rawUrl) {
      patches.push({ start: candidate.urlStart, end: candidate.urlEnd, replacement: result.record.rawUrl });
      replacements.push(result.record.rawUrl);
    }
  }

  return { markdown: applySpanPatches(candidateMarkdown, patches), replacements };
}

function firstMatch(results: readonly MatchResult<TrustedUrlRecord>[]): MatchResult<TrustedUrlRecord> {
  return results.find((result) => result.kind === "match") ?? { kind: "none" };
}

function matchByExactOrNormalized(candidate: ExtractedMarkdownUrl, inventory: TrustedUrlInventory): MatchResult<TrustedUrlRecord> {
  const records = [...inventory.lookupRaw(candidate.rawUrl)];
  const normalized = normalizeUrlForComparison(candidate.rawUrl);
  if (normalized.kind === "url") {
    records.push(...inventory.lookupStrict(normalized.strictKey));
    records.push(...inventory.lookupFetch(normalized.fetchKey));
  }

  return toMatchResult(dedupe(records));
}

function toMatchResult(records: readonly TrustedUrlRecord[]): MatchResult<TrustedUrlRecord> {
  if (records.length === 1) return { kind: "match", record: records[0] };
  if (records.length > 1) return { kind: "ambiguous", records };
  return { kind: "none" };
}

function dedupe(records: readonly TrustedUrlRecord[]): TrustedUrlRecord[] {
  const result: TrustedUrlRecord[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (!seen.has(record.rawUrl)) {
      seen.add(record.rawUrl);
      result.push(record);
    }
  }
  return result;
}

function mutateTrustedMarkdown(markdown: string, index: number): string {
  return markdown.replaceAll("example.com", index % 2 === 0 ? "exampel.com" : "example.con");
}

describe("URL reconciliation primitives composed locally", () => {
  it("repairs a mixed fixture without touching fenced code", () => {
    const trusted = fixture("multi-link-page.trusted.md");
    const candidate = fixture("multi-link-page.candidate.md");
    const result = repairMarkdown(candidate, trusted);

    expect(result.markdown).toContain("[BBC News](https://bbc.com/news/article)");
    expect(result.markdown).toContain("[Docs](https://docs.example.com/guide?x=1&y=2)");
    expect(result.markdown).toContain("[Wrapped](https://example.com/wrapped)");
    expect(result.markdown).toContain("https://candidate-code.example/keep");
  });

  it("repairs the BBC-style hallucinated host fixture", () => {
    const result = repairMarkdown(fixture("hallucinated-host.candidate.md"), fixture("hallucinated-host.trusted.md"));

    expect(result.markdown).toContain("https://bbc.com/news/article");
    expect(result.replacements).toEqual(["https://bbc.com/news/article"]);
  });

  it("does not over-repair adversarial host neighbors", () => {
    const result = repairMarkdown(fixture("adversarial-hosts.candidate.md"), fixture("adversarial-hosts.trusted.md"));

    expect(result.markdown).toContain("[BBC News](https://bbc.com/news/article)");
    expect(result.markdown).toContain("[Sports](https://bbb.com/sport)");
    expect(result.markdown).toContain("[Alphabet](https://abc.com/)");
    expect(result.replacements).toEqual(["https://bbc.com/news/article"]);
  });

  it("is deterministic", () => {
    const trusted = fixture("multi-link-page.trusted.md");
    const candidate = fixture("multi-link-page.candidate.md");

    expect(repairMarkdown(candidate, trusted)).toEqual(repairMarkdown(candidate, trusted));
  });

  it("preserves unmatched candidate URLs while patching matched URLs", () => {
    const trusted = "[A](https://example.com/a)";
    const candidate = "[A](https://exampel.com/a) [B](https://missing.example/b)";
    const result = repairMarkdown(candidate, trusted);

    expect(result.markdown).toBe("[A](https://example.com/a) [B](https://missing.example/b)");
  });

  it("keeps every replacement byte-equal to a trusted substring", () => {
    for (let index = 0; index < 100; index += 1) {
      const trusted = `[Link ${index}](https://example.com/path-${index}?q=${index})`;
      const candidate = mutateTrustedMarkdown(trusted, index);
      const result = repairMarkdown(candidate, trusted);

      expect(result.replacements.every((replacement) => trusted.includes(replacement))).toBe(true);
    }
  });
});
