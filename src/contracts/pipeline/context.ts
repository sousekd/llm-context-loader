/**
 * Defines the read-only context surface visible to pipeline steps.
 *
 * Steps inspect input, prior outcomes, body versions, scalar signals, and typed
 * artifacts through these contracts. They never mutate runtime state directly;
 * all state changes are requested through `StepEffects` returned from a step.
 */

import type { StepOutcome } from "./report.js";

/**
 * Represents a primitive value usable in inter-step coordination signals.
 *
 * Structurally identical to `DiagnosticValue` (in `diagnostics.ts`), but
 * conceptually distinct: `ScalarValue` flows between steps via {@link SignalBag}
 * and survives in `PipelineRunResult.signals`. `DiagnosticValue` flows to
 * renderers and persisted reports for observability.
 */
export type ScalarValue = string | number | boolean;

/** Represents a content-typed body and its optional title. */
export interface BodyContent {
  readonly content: string;
  readonly mediaType: string;
  readonly title?: string;
}

/** Describes one version of the orchestrator-owned body. */
export interface BodyVersion extends BodyContent {
  readonly stepName: string;
}

/** Carries the immutable caller input for one configured pipeline invocation. */
export interface PipelineInput {
  readonly url: string;
}

/** Exposes read-only access to orchestrator-owned body versions during step execution. */
export interface BodyView {
  /** Returns the current markdown body, if any. */
  current(): BodyContent | undefined;

  /** Returns an immutable snapshot of all body versions. */
  versions(): ReadonlyArray<BodyVersion>;
}

/** Exposes scalar coordination signals produced by earlier steps. */
export interface SignalBag {
  /** Returns a scalar signal value when present. */
  get(key: string): ScalarValue | undefined;

  /** Returns whether the named signal exists. */
  has(key: string): boolean;
}

/** Exposes typed artifact payloads produced by earlier steps. */
export interface ArtifactBag {
  /** Returns a typed artifact payload when present. */
  get<T>(key: string): T | undefined;

  /** Returns whether the named artifact exists. */
  has(key: string): boolean;
}

/**
 * Provides all read-only runtime state available to a step.
 *
 * The context intentionally does not expose a logger: steps log through
 * the identity-bound logger they received at construction time. Request
 * correlation fields are merged into every log line via AsyncLocalStorage.
 */
export interface PipelineContext {
  readonly input: PipelineInput;
  readonly startedAt: number;
  readonly signal: AbortSignal;
  readonly outcomes: ReadonlyArray<StepOutcome>;
  readonly body: BodyView;
  readonly signals: SignalBag;
  readonly artifacts: ArtifactBag;
}
