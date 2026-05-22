import type { MatchResult } from "../shared/match-result.js";
import type { ExtractedMarkdownUrl, NormalizedUrl, TrustedUrlInventory, TrustedUrlRecord } from "./types.js";

import { damerauLevenshteinBounded } from "../shared/damerau-levenshtein.js";
import { dedupeBy } from "../shared/dedupe-by.js";
import { toMatchResult } from "../shared/to-match-result.js";
import { normalizePathVariant, normalizeUrlForComparison } from "./normalize.js";

// Structural host-typo URL matching against trusted URLs.
// Requires path, query, and scheme agreement before bounded host edit distance is considered.
// security boundary — emitted URL is copied verbatim from trusted markdown; never synthesized

export interface HostTypoMatchOptions {
  readonly baseUrl?: string;
  /** Absolute edit-distance floor for short hosts. */
  readonly maxEditDistance: number;
  /** Ratio-based edit-distance budget for longer hosts. */
  readonly maxEditDistanceRatio: number;
}

/** Match a candidate URL whose host appears to be a bounded typo of a trusted URL host. */
export function matchByHostTypo(
  candidate: ExtractedMarkdownUrl,
  inventory: TrustedUrlInventory,
  options: HostTypoMatchOptions
): MatchResult<TrustedUrlRecord> {
  const normalized = normalizeUrlForComparison(candidate.rawUrl, { baseUrl: options.baseUrl });
  if (normalized.kind !== "url") return { kind: "none" };

  const path = normalizePathVariant(normalized.path);
  const records = inventory.lookupByHostPath(path).filter((record) => matchesStructure(normalized, record));
  const typoMatches = records.filter((record) => {
    const budget = hostDistanceBudget(normalized.host, options);
    const distance = damerauLevenshteinBounded(normalized.host, record.normalized.host, budget);
    return distance > 0 && distance <= budget;
  });

  return toMatchResult(dedupeBy(typoMatches, (record) => record.normalized.strictKey));
}

/** Test structural agreement before host typo distance. */
function matchesStructure(normalized: NormalizedUrl, record: TrustedUrlRecord): boolean {
  return (
    normalized.scheme === record.normalized.scheme &&
    normalizePathVariant(normalized.path) === normalizePathVariant(record.normalized.path) &&
    normalized.queryKey === record.normalized.queryKey
  );
}

/** Compute the larger of the absolute floor and ratio-based edit distance budget for a host. */
function hostDistanceBudget(host: string, options: HostTypoMatchOptions): number {
  const absolute = Math.max(0, Math.floor(options.maxEditDistance));
  const ratio = Math.ceil(Math.max(0, options.maxEditDistanceRatio) * Math.max(1, host.length));
  return Math.max(absolute, ratio);
}

