/**
 * Defines observability-only diagnostics attached to step results and reports.
 *
 * Diagnostics flow into `StepReport` and output renderers such as the XML
 * footer. They are not exposed to subsequent steps; inter-step coordination
 * uses scalar signals and typed artifacts from `StepEffects` instead.
 */

/**
 * Represents a primitive value attached to a step's observability diagnostics.
 *
 * Structurally identical to `ScalarValue` (in `context.ts`), but used only for
 * data that surfaces in `StepReport.diagnostics` (XML footer, future JSON
 * reports). Diagnostics never flow to subsequent steps; use `ScalarValue`
 * signals for inter-step coordination.
 */
export type DiagnosticValue = string | number | boolean;

/** Describes a nested diagnostic node attached to a step report. */
export interface ChildReportNode {
  readonly name: string;
  readonly attributes?: Record<string, DiagnosticValue>;
  readonly children?: ReadonlyArray<ChildReportNode>;
}

/**
 * Describes diagnostic-only data a step attaches to its result.
 *
 * Diagnostics flow into the persisted `StepReport` and into output renderers
 * (XML footer, future JSON reports). They are not exposed to subsequent
 * steps; inter-step coordination uses `signals` and `artifacts`. Keep this
 * surface for logging, debugging, and observability only.
 */
export interface StepDiagnostics {
  readonly attributes?: Record<string, DiagnosticValue>;
  readonly children?: ReadonlyArray<ChildReportNode>;
}
