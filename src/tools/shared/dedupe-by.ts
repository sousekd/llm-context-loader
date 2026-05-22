// Generic order-preserving deduplication by a derived key.

/**
 * Return items in input order with later duplicates removed, where two items are considered
 * duplicates if `keyOf` returns the same key (compared via Set equality).
 */
export function dedupeBy<T, K>(items: readonly T[], keyOf: (item: T) => K): T[] {
  const result: T[] = [];
  const seen = new Set<K>();
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
