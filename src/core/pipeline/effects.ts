/**
 * Applies step-requested effects to orchestrator-owned pipeline state.
 *
 * Effects are the only mutation channel available to steps. The canonical order
 * is body, then signals, then artifacts. Failed-step effects are intentional and
 * support quality gates such as body rollback while still degrading the report.
 */

import type { ScalarValue } from "../../contracts/pipeline/context.js";
import type { StepResult } from "../../contracts/pipeline/step.js";
import type { BodyStore } from "./body.js";

/** Describes mutable orchestrator state that step effects may update. */
export interface EffectState {
  readonly body: BodyStore;
  readonly signals: Map<string, ScalarValue>;
  readonly artifacts: Map<string, unknown>;
}

/** Summarizes state changes applied after an ok or failed step result. */
export interface AppliedEffectsSummary {
  readonly outputChars?: number;
  readonly wroteBody: boolean;
}

/**
 * Applies step effects in the canonical body, signal, artifact order.
 *
 * Effects apply on `ok` or `failed` status; `skipped` results never apply
 * effects. Allowing effects on `failed` lets a step that detected a problem
 * report the failure and mutate state in one result. The pipeline rollup still
 * treats the step as failed.
 */
export function applyStepEffects(stepName: string, result: StepResult, state: EffectState): AppliedEffectsSummary {
  if (result.status === "skipped" || !result.effects) return { wroteBody: false };

  if (result.effects.body) {
    state.body.append({ stepName, ...result.effects.body });
  }

  for (const [key, value] of Object.entries(result.effects.signals ?? {})) {
    if (value === null) state.signals.delete(key);
    else state.signals.set(key, value);
  }

  for (const [key, value] of Object.entries(result.effects.artifacts ?? {})) {
    if (value === null) state.artifacts.delete(key);
    else state.artifacts.set(key, value);
  }

  return {
    outputChars: result.effects.body?.content.length,
    wroteBody: Boolean(result.effects.body)
  };
}
