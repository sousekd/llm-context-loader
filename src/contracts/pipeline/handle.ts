/**
 * Describes how adapters invoke one already-bound configured pipeline.
 *
 * A `PipelineHandle` hides the orchestrator, runner, and compiled pipeline from
 * adapter implementations. Adapters can either run the pipeline for one input
 * or ask the configured renderer to produce a synthetic failure document for a
 * per-URL adapter failure.
 */

import type { PipelineInput } from "./context.js";
import type { PipelineRunResult } from "./report.js";

/** Carries the rendered markdown and the raw run result for one invocation. */
export interface PipelineRunOutput {
  readonly markdown: string;
  readonly run: PipelineRunResult;
}

/** Invokes one bound pipeline for adapter consumers. */
export interface PipelineHandle {
  /** Runs the bound pipeline and returns both markdown and the raw run result. */
  run(input: PipelineInput): Promise<PipelineRunOutput>;

  /** Renders a synthetic failure through the bound pipeline's renderer. */
  renderFailure(input: PipelineInput, error: unknown): Promise<string>;
}
