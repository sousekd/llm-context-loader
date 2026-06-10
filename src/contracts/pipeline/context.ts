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

/** Fields shared by every body representation. */
export interface BodyBase {
  readonly title?: string;
}

/** A text body carried as a string. */
export interface TextBody extends BodyBase {
  readonly kind: "text";
  readonly mediaType: string;
  readonly content: string;
}

/** A binary body carried as bytes. */
export interface BinaryBody extends BodyBase {
  readonly kind: "binary";
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

/** The pipeline body in either representation. */
export type BodyContent = TextBody | BinaryBody;

/** One version of the orchestrator-owned body. */
export type BodyVersion = BodyContent & { readonly stepName: string };

/** Narrows a body to its text representation. */
export function isTextBody(body: BodyContent): body is TextBody {
  return body.kind === "text";
}

/** Narrows a body to its binary representation. */
export function isBinaryBody(body: BodyContent): body is BinaryBody {
  return body.kind === "binary";
}

/** Returns the body length: characters for text, bytes for binary. */
export function bodyLength(body: BodyContent): number {
  return body.kind === "text" ? body.content.length : body.bytes.byteLength;
}

/** Carries the immutable caller input for one configured pipeline invocation. */
export interface PipelineInput {
  readonly url: string;
}

/** Exposes read-only access to orchestrator-owned body versions during step execution. */
export interface BodyView {
  /** Returns the current content-typed body, if any. */
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
