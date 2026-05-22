// Bounded edit distance primitive for reconciliation matchers.
// Returns maxDistance + 1 once the exact distance cannot be within the bound.

/**
 * Compute bounded Damerau-Levenshtein distance (with adjacent transpositions) between
 * `a` and `b`. Strings are compared by Unicode code points (via `Array.from`), so surrogate
 * pairs count as one character. Returns the exact distance when it is `<= maxDistance`, and
 * `maxDistance + 1` otherwise.
 */
export function damerauLevenshteinBounded(a: string, b: string, maxDistance: number): number {
  const limit = Math.max(0, Math.floor(maxDistance));
  const left = Array.from(a);
  const right = Array.from(b);

  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  if (left.length === 0) return right.length <= limit ? right.length : limit + 1;
  if (right.length === 0) return left.length <= limit ? left.length : limit + 1;

  let previousPrevious = new Array<number>(right.length + 1).fill(limit + 1);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    current[0] = leftIndex;
    let rowMinimum = current[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const deletion = previous[rightIndex] + 1;
      const insertion = current[rightIndex - 1] + 1;
      const substitution = previous[rightIndex - 1] + cost;
      let value = Math.min(deletion, insertion, substitution);

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        value = Math.min(value, previousPrevious[rightIndex - 2] + 1);
      }

      current[rightIndex] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > limit) return limit + 1;

    previousPrevious = previous;
    previous = current;
  }

  const distance = previous[right.length];
  return distance <= limit ? distance : limit + 1;
}
