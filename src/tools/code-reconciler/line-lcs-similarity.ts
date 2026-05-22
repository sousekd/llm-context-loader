import type { NormalizeCodeOptions } from "./types.js";

import { longestCommonSubsequenceLength } from "../shared/lcs.js";
import { normalizeCodeForComparison, splitCodeLines } from "./normalize.js";

// Line-LCS similarity for code-block scoring.
// Callers decide thresholds and how to combine this with other signals.

/** Return line-based LCS similarity in the inclusive range [0, 1]. */
export function lineLcsSimilarity(leftCode: string, rightCode: string, options: NormalizeCodeOptions = {}): number {
  const leftLines = splitCodeLines(normalizeCodeForComparison(leftCode, options));
  const rightLines = splitCodeLines(normalizeCodeForComparison(rightCode, options));
  const denominator = Math.max(leftLines.length, rightLines.length);
  if (denominator === 0) return 1;
  return longestCommonSubsequenceLength(leftLines, rightLines) / denominator;
}
