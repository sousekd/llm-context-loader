/**
 * Defines the condition model for engine-driven step gating (runIf/skipIf).
 *
 * Conditions are a recursive discriminated union evaluated against the
 * runtime signal bag. A bare string leaf tests whether that signal
 * exists and is truthy. Combinators all/any/not nest arbitrarily.
 */

/** Describes a signal-based predicate for runIf/skipIf evaluation. */
export type Condition =
  | string
  | { readonly all: ReadonlyArray<Condition> }
  | { readonly any: ReadonlyArray<Condition> }
  | { readonly not: Condition };
