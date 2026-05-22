// Shared matcher result shape for low-level reconciliation tools.
// Encodes cardinality only; callers own verdicts, policy, and orchestration.

export type MatchResult<T> =
  | { readonly kind: "match"; readonly record: T }
  | { readonly kind: "ambiguous"; readonly records: readonly T[] }
  | { readonly kind: "none" };
