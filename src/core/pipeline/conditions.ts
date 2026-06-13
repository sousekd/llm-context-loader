/**
 * Evaluates Condition predicates against a runtime signal lookup.
 *
 * The signal lookup is intentionally an abstract function so this module
 * stays decoupled from the orchestrator-owned signal map. Gate resolution
 * follows the rule: step runs iff (runIf absent or true) AND (skipIf absent
 * or false).
 */

import type { Condition } from "../../contracts/pipeline/condition.js";
import type { ScalarValue } from "../../contracts/pipeline/context.js";

/** Looks up a signal by name, returning undefined when absent. */
export type SignalLookup = (name: string) => ScalarValue | undefined;

/** Describes the reserved skip reason produced by engine-level step gates. */
export type StepGateReason = "run_if_unmet" | "skip_if_met";

/** Returns true when a scalar value is truthy in the signal domain. */
export function isTruthySignal(value: ScalarValue | undefined): boolean {
  return value !== undefined && value !== false && value !== 0 && value !== "";
}

/** Evaluates a Condition against a signal lookup. */
export function evaluateCondition(condition: Condition, lookup: SignalLookup): boolean {
  if (typeof condition === "string") return isTruthySignal(lookup(condition));
  if ("all" in condition) return condition.all.every(c => evaluateCondition(c, lookup));
  if ("any" in condition) return condition.any.some(c => evaluateCondition(c, lookup));
  if ("not" in condition) return !evaluateCondition(condition.not, lookup);
  return false;
}

/**
 * Resolves the engine-driven gate for one step.
 *
 * Returns a reserved skip reason when the step should be gated, or undefined
 * when the step should run normally. runIf takes precedence over skipIf when
 * both are present.
 */
export function resolveStepGate(
  gates: { readonly runIf?: Condition; readonly skipIf?: Condition },
  lookup: SignalLookup
): StepGateReason | undefined {
  if (gates.runIf !== undefined && !evaluateCondition(gates.runIf, lookup)) return "run_if_unmet";
  if (gates.skipIf !== undefined && evaluateCondition(gates.skipIf, lookup)) return "skip_if_met";
  return undefined;
}
