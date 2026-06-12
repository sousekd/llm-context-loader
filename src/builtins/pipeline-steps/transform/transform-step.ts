/**
 * Runs a configured content transformer against the current pipeline body.
 *
 * The step is transformer-agnostic. It asks the resolved transformer whether it
 * supports the current body for the requested target, runs it, then asserts the
 * result matches the requested target media type and representation before
 * applying it. This intrinsic honesty gate keeps transformers truthful.
 */

import { isAbortError } from "../../../shared/errors.js";
import { isTextLike } from "../../../shared/media-types.js";

import type {
  ContentTransformDiagnostic,
  ContentTransformRequest,
  ContentTransformer
} from "../../../contracts/extensions/content-transformer.js";
import type { BodyContent, PipelineContext } from "../../../contracts/pipeline/context.js";
import type { StepDiagnostics } from "../../../contracts/pipeline/diagnostics.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { TransformStepOptions } from "./transform-step-config.js";

/** Transforms the current body toward a target representation via a transformer. */
export class TransformStep implements PipelineStep {
  /** Creates a transform step instance. */
  constructor(
    private readonly config: TransformStepOptions,
    private readonly deps: { readonly transformer: ContentTransformer; readonly logger: Logger }
  ) {}

  /** Runs the transformer when it supports the current body for the target. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    if (!body) return { status: "skipped", reason: "no_body" };

    const request: ContentTransformRequest = { targetMediaType: this.config.target };
    if (!this.deps.transformer.supports({ sourceKind: body.kind, sourceMediaType: body.mediaType, request }))
      return { status: this.config.onUnsupported === "fail" ? "failed" : "skipped", reason: "unsupported" };

    let result;
    try {
      result = await this.deps.transformer.transform({ url: ctx.input.url, body, request }, { signal: ctx.signal });
    } catch (error) {
      if (isAbortError(error)) return { status: "failed", reason: "timeout" };
      throw error;
    }

    if (result.outcome === "declined")
      return { status: this.config.onDeclined === "fail" ? "failed" : "skipped", reason: result.reason ?? "declined" };

    if (!outputMatchesTarget(result.body, this.config.target)) return { status: "failed", reason: "wrong_output_type" };

    return {
      status: "ok",
      effects: { body: result.body },
      diagnostics: this.config.emitDiagnostics ? toStepDiagnostics(result.diagnostics) : undefined
    };
  }
}

/** Returns whether a transformer result matches the requested target type and representation. */
function outputMatchesTarget(body: BodyContent, target: string): boolean {
  if (body.mediaType !== target) return false;
  return isTextLike(target) ? body.kind === "text" : body.kind === "binary";
}

/** Maps transformer diagnostics into a step diagnostics tree, or undefined when empty. */
function toStepDiagnostics(
  diagnostics: ReadonlyArray<ContentTransformDiagnostic> | undefined
): StepDiagnostics | undefined {
  if (!diagnostics || diagnostics.length === 0) return undefined;
  return {
    children: diagnostics.map(diagnostic => ({
      name: diagnostic.code,
      attributes: diagnostic.message === undefined ? undefined : { message: diagnostic.message }
    }))
  };
}
