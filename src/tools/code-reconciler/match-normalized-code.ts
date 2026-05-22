import type { MatchResult } from "../shared/match-result.js";
import type { ExtractedMarkdownCodeBlock, NormalizeCodeOptions, TrustedCodeBlockInventory, TrustedCodeBlockRecord } from "./types.js";

import { dedupeBy } from "../shared/dedupe-by.js";
import { toMatchResult } from "../shared/to-match-result.js";
import { normalizeCodeForComparison } from "./normalize.js";

// Normalized code-body matching against a trusted code-block inventory.
// security boundary — emitted blocks are copied verbatim from trusted markdown; never synthesized

export interface NormalizedCodeMatchOptions extends NormalizeCodeOptions {
  readonly filter?: (candidate: ExtractedMarkdownCodeBlock, record: TrustedCodeBlockRecord) => boolean;
}

/** Match a candidate code block by normalized code body. */
export function matchByNormalizedCode(
  candidate: ExtractedMarkdownCodeBlock,
  inventory: TrustedCodeBlockInventory,
  options: NormalizedCodeMatchOptions = {}
): MatchResult<TrustedCodeBlockRecord> {
  const key = normalizeCodeForComparison(candidate.rawCode, options);
  const records = inventory.lookupNormalizedCode(key);
  const filter = options.filter;
  const qualifying = filter ? records.filter((record) => filter(candidate, record)) : records;

  return toMatchResult(dedupeBy(qualifying, (record) => record.extracted.rawBlock));
}
