import type { ExtractedMarkdownUrl, NormalizeUrlsOptions, TrustedUrlInventory, TrustedUrlRecord } from "./types.js";

import { normalizeAnchorText, normalizePathVariant, normalizeUrlForComparison } from "./normalize.js";

// Trusted URL inventory for URL reconciliation matchers.
// Stores only URLs that parse under the supplied normalization options.

/** Build a trusted URL inventory with named lookup tiers. */
export function buildTrustedUrlInventory(records: readonly ExtractedMarkdownUrl[], options: NormalizeUrlsOptions = {}): TrustedUrlInventory {
  const all: TrustedUrlRecord[] = [];
  const byRaw = new Map<string, TrustedUrlRecord[]>();
  const byStrict = new Map<string, TrustedUrlRecord[]>();
  const byFetch = new Map<string, TrustedUrlRecord[]>();
  const byAnchorText = new Map<string, TrustedUrlRecord[]>();
  const byHostPath = new Map<string, TrustedUrlRecord[]>();

  for (const extracted of records) {
    const normalized = normalizeUrlForComparison(extracted.rawUrl, options);
    if (normalized.kind !== "url") continue;

    let record = byRaw.get(extracted.rawUrl)?.[0];
    if (!record) {
      record = { extracted, rawUrl: extracted.rawUrl, text: extracted.text, normalized };
      all.push(record);
      add(byRaw, record.rawUrl, record);
      add(byStrict, normalized.strictKey, record);
      add(byFetch, normalized.fetchKey, record);
      add(byHostPath, normalizePathVariant(normalized.path), record);
    }

    if (record.text) addUnique(byAnchorText, normalizeAnchorText(record.text), record);
    if (extracted.text && extracted.text !== record.text) addUnique(byAnchorText, normalizeAnchorText(extracted.text), record);
  }

  return {
    lookupRaw(rawUrl) {
      return byRaw.get(rawUrl) ?? [];
    },
    lookupStrict(strictKey) {
      return byStrict.get(strictKey) ?? [];
    },
    lookupFetch(fetchKey) {
      return byFetch.get(fetchKey) ?? [];
    },
    lookupAnchorText(text) {
      return byAnchorText.get(normalizeAnchorText(text)) ?? [];
    },
    lookupByHostPath(path) {
      return byHostPath.get(normalizePathVariant(path)) ?? [];
    },
    allRecords() {
      return all;
    }
  };
}

/** Add one value to a multimap. */
function add(map: Map<string, TrustedUrlRecord[]>, key: string, value: TrustedUrlRecord): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

/** Add one value to a multimap unless the same record is already present. */
function addUnique(map: Map<string, TrustedUrlRecord[]>, key: string, value: TrustedUrlRecord): void {
  const existing = map.get(key);
  if (existing) {
    if (!existing.includes(value)) existing.push(value);
  } else {
    map.set(key, [value]);
  }
}
