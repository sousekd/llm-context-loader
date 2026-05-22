import type { MatchResult } from "./match-result.js";

// Generic scored matching helper for low-level reconciliation tools.
// security boundary — emitted records are returned verbatim; this helper never synthesizes content.

export interface ScoreMatchOptions<T> {
  readonly score: (record: T) => number;
  readonly minScore: number;
  readonly minMargin?: number;
}

interface ScoredRecord<T> {
  readonly record: T;
  readonly score: number;
  readonly index: number;
}

/** Select a single scored record when it clears score and margin requirements. */
export function matchByScore<T>(records: readonly T[], options: ScoreMatchOptions<T>): MatchResult<T> {
  const scored = records
    .map((record, index): ScoredRecord<T> => ({ record, score: options.score(record), index }))
    .filter((record) => Number.isFinite(record.score) && record.score >= options.minScore)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (scored.length === 0) return { kind: "none" };
  if (scored.length === 1) return { kind: "match", record: scored[0].record };

  const minMargin = options.minMargin ?? 0;
  const topScore = scored[0].score;
  const secondScore = scored[1].score;
  if (topScore - secondScore > minMargin) return { kind: "match", record: scored[0].record };

  return { kind: "ambiguous", records: scored.filter((record) => topScore - record.score <= minMargin).map((record) => record.record) };
}
