import type { MatchResult } from "../shared/match-result.js";
import type { ExtractedMarkdownUrl, TrustedUrlInventory, TrustedUrlRecord } from "./types.js";

import { dedupeBy } from "../shared/dedupe-by.js";
import { toMatchResult } from "../shared/to-match-result.js";
import { generateDeterministicUrlCandidates } from "./deterministic-repairs.js";
import { normalizeUrlForComparison } from "./normalize.js";

// Deterministic URL repair matching against a trusted URL inventory.
// The matcher returns cardinality only; callers decide whether to patch.
// security boundary — emitted URL is copied verbatim from trusted markdown; never synthesized

export interface DeterministicMatchOptions {
  readonly baseUrl?: string;
}

/** Match a candidate URL through deterministic string repair candidates. */
export function matchByDeterministicRepair(
  candidate: ExtractedMarkdownUrl,
  inventory: TrustedUrlInventory,
  options: DeterministicMatchOptions = {}
): MatchResult<TrustedUrlRecord> {
  const records: TrustedUrlRecord[] = [];

  for (const repaired of generateDeterministicUrlCandidates(candidate.rawUrl)) {
    records.push(...inventory.lookupRaw(repaired));

    const normalized = normalizeUrlForComparison(repaired, options);
    if (normalized.kind === "url") {
      records.push(...inventory.lookupStrict(normalized.strictKey));
      records.push(...inventory.lookupFetch(normalized.fetchKey));
    }
  }

  return toMatchResult(dedupeBy(records, (record) => record.normalized.strictKey));
}
