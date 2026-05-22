import type { MatchResult } from "../shared/match-result.js";
import type { ExtractedMarkdownCodeBlock, TrustedCodeBlockInventory, TrustedCodeBlockRecord } from "./types.js";

import { dedupeBy } from "../shared/dedupe-by.js";
import { toMatchResult } from "../shared/to-match-result.js";

// Raw code-body matching against a trusted code-block inventory.
// security boundary — emitted blocks are copied verbatim from trusted markdown; never synthesized

export interface RawCodeMatchOptions {
  readonly filter?: (candidate: ExtractedMarkdownCodeBlock, record: TrustedCodeBlockRecord) => boolean;
}

/** Match a candidate code block by exact raw code body. */
export function matchByRawCode(
  candidate: ExtractedMarkdownCodeBlock,
  inventory: TrustedCodeBlockInventory,
  options: RawCodeMatchOptions = {}
): MatchResult<TrustedCodeBlockRecord> {
  const records = inventory.lookupRawCode(candidate.rawCode);
  const filter = options.filter;
  const qualifying = filter ? records.filter((record) => filter(candidate, record)) : records;

  return toMatchResult(dedupeBy(qualifying, (record) => record.extracted.rawBlock));
}
