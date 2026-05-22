// Longest-common-subsequence primitive for reconciliation scoring.
// The implementation is generic and carries no markdown or URL policy.

export interface LongestCommonSubsequenceOptions<T> {
  readonly equals?: (left: T, right: T) => boolean;
}

/** Return the length of the longest common subsequence between two sequences. */
export function longestCommonSubsequenceLength<T>(
  left: readonly T[],
  right: readonly T[],
  options: LongestCommonSubsequenceOptions<T> = {}
): number {
  if (left.length === 0 || right.length === 0) return 0;

  const equals = options.equals ?? Object.is;
  let previous = new Array<number>(right.length + 1).fill(0);
  let current = new Array<number>(right.length + 1).fill(0);

  for (const leftValue of left) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] = equals(leftValue, right[rightIndex])
        ? previous[rightIndex] + 1
        : Math.max(previous[rightIndex + 1], current[rightIndex]);
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }

  return previous[right.length];
}
