/**
 * Defines pipeline run reports consumed by renderers, adapters, and diagnostics.
 *
 * Reports are the durable, observability-oriented view of a run. Subsequent
 * steps see only compact `StepOutcome` values, while renderers receive full
 * timing, diagnostics, body rollups, and detached signal/artifact snapshots.
 */

import type { BodyContent, ScalarValue } from "./context.js";
import type { StepDiagnostics } from "./diagnostics.js";
import type { StepStatus } from "./step.js";

/** Enumerates the rollup status set reported for a full pipeline run. */
export type PipelineRunStatus = "ok" | "degraded" | "failed";

/**
 * Describes the compact outcome visible to subsequent steps.
 *
 * Intentionally excludes diagnostics: inter-step coordination uses
 * `signals` and `artifacts`. Diagnostics surface only on `StepReport`.
 */
export interface StepOutcome {
  readonly name: string;
  readonly type: string;
  readonly status: StepStatus;
  readonly inputLength?: number;
  readonly outputLength?: number;
  readonly reason?: string;
}

/** Describes a timed, persisted report for one executed step. */
export interface StepReport extends StepOutcome {
  readonly startedAt: number;
  readonly durationMs: number;
  readonly diagnostics?: StepDiagnostics;
}

/** Describes diagnostics and rollups for a full configured pipeline run. */
export interface PipelineReport {
  readonly url: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly initialLength: number;
  readonly finalLength: number;
  readonly ratio?: number;
  readonly returned: string;
  readonly result: PipelineRunStatus;
  readonly steps: ReadonlyArray<StepReport>;
  readonly bodyProducedBy?: string;
  readonly bodyChangedBy?: string;
  readonly error?: string;
}

/**
 * Carries the final body, report, and runtime snapshots returned by the orchestrator.
 *
 * `body` is undefined when no step produced one. `signals` and `artifacts` are
 * detached snapshots taken at run completion, decoupled from the mutable runtime
 * state the orchestrator discards after the run.
 */
export interface PipelineRunResult {
  readonly body?: BodyContent;
  readonly report: PipelineReport;
  readonly signals: ReadonlyMap<string, ScalarValue>;
  readonly artifacts: ReadonlyMap<string, unknown>;
}
