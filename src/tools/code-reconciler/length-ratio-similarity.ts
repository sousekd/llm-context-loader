// Length-ratio similarity for code-block scoring.
// This primitive measures only relative size, not semantic safety.

export interface LengthRatioSimilarityOptions {
  readonly ignoreWhitespace?: boolean;
}

/** Return shorter/longer length ratio in the inclusive range [0, 1]. */
export function lengthRatioSimilarity(leftCode: string, rightCode: string, options: LengthRatioSimilarityOptions = {}): number {
  const leftLength = comparableLength(leftCode, options);
  const rightLength = comparableLength(rightCode, options);
  const longer = Math.max(leftLength, rightLength);
  if (longer === 0) return 1;
  return Math.min(leftLength, rightLength) / longer;
}

/** Return the length after optional whitespace removal. */
function comparableLength(code: string, options: LengthRatioSimilarityOptions): number {
  return options.ignoreWhitespace === true ? code.replace(/\s+/g, "").length : code.length;
}
