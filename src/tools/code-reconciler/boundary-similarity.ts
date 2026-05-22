import type { NormalizeCodeOptions } from "./types.js";

import { normalizeCodeForComparison, splitCodeLines } from "./normalize.js";

// Boundary-line similarity for code-block scoring.
// It compares first and last non-empty lines only; callers own all threshold policy.

interface Boundaries {
  readonly first?: string;
  readonly last?: string;
}

/**
 * Return first/last non-empty-line similarity. Output is discrete: 1 when both boundaries match
 * (or both inputs are empty), 0.5 when only one boundary matches, 0 otherwise.
 */
export function boundarySimilarity(leftCode: string, rightCode: string, options: NormalizeCodeOptions = {}): number {
  const left = boundaries(leftCode, options);
  const right = boundaries(rightCode, options);
  if (!left.first && !right.first) return 1;
  if (!left.first || !right.first) return 0;

  const firstScore = left.first === right.first ? 0.5 : 0;
  const lastScore = left.last === right.last ? 0.5 : 0;
  return firstScore + lastScore;
}

/** Extract first and last non-empty normalized lines. */
function boundaries(code: string, options: NormalizeCodeOptions): Boundaries {
  const lines = splitCodeLines(normalizeCodeForComparison(code, options)).filter((line) => line.trim().length > 0);
  return { first: lines[0], last: lines.at(-1) };
}
