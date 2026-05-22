import type { MatchResult } from "./match-result.js";

// Map a list of candidate records into a MatchResult cardinality (none / match / ambiguous).
// security boundary — emitted records are returned verbatim; this helper never synthesizes content.

/**
 * Convert a list of candidate records into a cardinality result. Returns `none` for empty input,
 * `match` for a single record, and `ambiguous` for two or more.
 */
export function toMatchResult<T>(records: readonly T[]): MatchResult<T> {
  if (records.length === 1) return { kind: "match", record: records[0] };
  if (records.length > 1) return { kind: "ambiguous", records };
  return { kind: "none" };
}
