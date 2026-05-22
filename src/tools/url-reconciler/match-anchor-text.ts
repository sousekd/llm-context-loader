import type { MatchResult } from "../shared/match-result.js";
import type { ExtractedMarkdownUrl, TrustedUrlInventory, TrustedUrlRecord } from "./types.js";

import { dedupeBy } from "../shared/dedupe-by.js";
import { toMatchResult } from "../shared/to-match-result.js";
import { normalizeAnchorText } from "./normalize.js";

// Anchor-text URL matching against a trusted URL inventory.
// Ships no heuristic for "broken" candidate URLs — callers supply a predicate if they need filtering.
// security boundary — emitted URL is copied verbatim from trusted markdown; never synthesized

export interface AnchorTextMatchOptions {
  readonly filter?: (candidate: ExtractedMarkdownUrl, record: TrustedUrlRecord) => boolean;
}

/**
 * Match a candidate URL by exact normalized anchor text. Returns every trusted record whose
 * anchor text matches the candidate's, deduplicated. If `filter` is supplied, only records
 * for which the predicate returns `true` qualify.
 */
export function matchByAnchorText(
  candidate: ExtractedMarkdownUrl,
  inventory: TrustedUrlInventory,
  options: AnchorTextMatchOptions = {}
): MatchResult<TrustedUrlRecord> {
  const anchorText = candidate.text ? normalizeAnchorText(candidate.text) : "";
  if (anchorText.length === 0) return { kind: "none" };

  const records = inventory.lookupAnchorText(anchorText);
  const filter = options.filter;
  const qualifying = filter ? records.filter((record) => filter(candidate, record)) : records;

  return toMatchResult(dedupeBy(qualifying, (record) => record.normalized.strictKey));
}
