import type { ExtractedMarkdownCodeBlock, NormalizeCodeOptions, TrustedCodeBlockInventory, TrustedCodeBlockRecord } from "./types.js";

import { normalizeCodeForComparison, normalizeLanguageAlias } from "./normalize.js";

// Trusted code-block inventory for markdown code-block reconciliation matchers.
// Stores only extracted blocks the fenced-code extractor considered unambiguous.

/** Build a trusted code-block inventory with named lookup tiers. */
export function buildTrustedCodeBlockInventory(
  records: readonly ExtractedMarkdownCodeBlock[],
  options: NormalizeCodeOptions = {}
): TrustedCodeBlockInventory {
  const all: TrustedCodeBlockRecord[] = [];
  const seenRawBlock = new Set<string>();
  const byRawBlock = new Map<string, TrustedCodeBlockRecord[]>();
  const byRawCode = new Map<string, TrustedCodeBlockRecord[]>();
  const byNormalizedCode = new Map<string, TrustedCodeBlockRecord[]>();
  const byLanguage = new Map<string, TrustedCodeBlockRecord[]>();

  for (const extracted of records) {
    if (seenRawBlock.has(extracted.rawBlock)) continue;

    const language = extracted.language ? normalizeLanguageAlias(extracted.language) : undefined;
    const normalizedCodeKey = normalizeCodeForComparison(extracted.rawCode, options);
    const record: TrustedCodeBlockRecord = { extracted, language, normalizedCodeKey };

    seenRawBlock.add(extracted.rawBlock);
    all.push(record);
    add(byRawBlock, extracted.rawBlock, record);
    add(byRawCode, extracted.rawCode, record);
    add(byNormalizedCode, normalizedCodeKey, record);
    if (language) add(byLanguage, language, record);
  }

  return {
    lookupRawBlock(rawBlock) {
      return byRawBlock.get(rawBlock) ?? [];
    },
    lookupRawCode(rawCode) {
      return byRawCode.get(rawCode) ?? [];
    },
    lookupNormalizedCode(normalizedCodeKey) {
      return byNormalizedCode.get(normalizedCodeKey) ?? [];
    },
    lookupByLanguage(language) {
      const normalizedLanguage = normalizeLanguageAlias(language);
      return normalizedLanguage ? byLanguage.get(normalizedLanguage) ?? [] : [];
    },
    allRecords() {
      return all;
    }
  };
}

/** Add one value to a multimap. */
function add(map: Map<string, TrustedCodeBlockRecord[]>, key: string, value: TrustedCodeBlockRecord): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}
