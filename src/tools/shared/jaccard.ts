// Jaccard similarity primitive for set-like reconciliation scoring.
// Inputs are converted to Sets; duplicate values do not affect the score.

/** Return Jaccard similarity in the inclusive range [0, 1]. */
export function jaccardSimilarity<T>(left: Iterable<T>, right: Iterable<T>): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set<T>(leftSet);

  for (const value of rightSet) union.add(value);
  if (union.size === 0) return 1;

  let intersectionSize = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersectionSize += 1;
  }

  return intersectionSize / union.size;
}
