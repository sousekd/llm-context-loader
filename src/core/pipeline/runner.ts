/**
 * Runs compiled pipelines and invokes their configured output renderers.
 *
 * Adapters depend on the runner through `PipelineHandle` rather than touching
 * orchestrator or compiled-pipeline internals. Renderer failures are wrapped as
 * `InternalError("renderer_failed")` so callers receive a stable 500 path
 * instead of a partially rendered or corrupted document.
 */

import { BaseError, InternalError } from "../../shared/errors.js";

import type { PipelineInput, ScalarValue } from "../../contracts/pipeline/context.js";
import type { PipelineHandle, PipelineRunOutput } from "../../contracts/pipeline/handle.js";
import type { PipelineReport, PipelineRunResult } from "../../contracts/pipeline/report.js";
import type { CompiledPipeline } from "./compiled.js";
import type { PipelineOrchestrator } from "./orchestrator.js";

/** Runs a pipeline and renders the result with its configured renderer. */
export class PipelineRunner {
  /** Creates a runner that delegates execution to the shared orchestrator. */
  constructor(private readonly orchestrator: PipelineOrchestrator) {}

  /** Runs the pipeline and returns the rendered markdown alongside the raw report. */
  async run(pipeline: CompiledPipeline, input: PipelineInput): Promise<PipelineRunOutput> {
    const run = await this.orchestrator.run(pipeline, input);
    const markdown = await renderOrThrow(pipeline, {
      pipelineName: pipeline.name,
      body: run.body,
      signals: run.signals,
      artifacts: run.artifacts,
      report: run.report
    });
    return { markdown, run };
  }

  /**
   * Renders a synthetic failure report for one input without running the pipeline.
   *
   * Used by HTTP adapters when an upstream failure (network, validation, abort)
   * prevents the pipeline from running but a renderer-shaped response is still
   * required so per-URL failures stay isolated and consistently formatted.
   */
  async renderFailure(pipeline: CompiledPipeline, input: PipelineInput, error: unknown): Promise<string> {
    const report = synthesizeFailureReport(input.url, error);
    return renderOrThrow(pipeline, {
      pipelineName: pipeline.name,
      body: undefined,
      signals: new Map(),
      artifacts: new Map(),
      report
    });
  }

  /** Curries the runner against one compiled pipeline to produce a port-shaped handle. */
  bindTo(pipeline: CompiledPipeline): PipelineHandle {
    return {
      run: input => this.run(pipeline, input),
      renderFailure: (input, error) => this.renderFailure(pipeline, input, error)
    };
  }
}

/** Invokes the configured renderer and wraps thrown errors as InternalError. */
async function renderOrThrow(
  pipeline: CompiledPipeline,
  input: {
    readonly pipelineName: string;
    readonly body: PipelineRunResult["body"];
    readonly signals: ReadonlyMap<string, ScalarValue>;
    readonly artifacts: ReadonlyMap<string, unknown>;
    readonly report: PipelineReport;
  }
): Promise<string> {
  try {
    const result = await pipeline.renderer.render(input);
    return result.markdown;
  } catch (cause) {
    throw new InternalError("Renderer threw", "renderer_failed", { cause });
  }
}

/** Builds a degraded pipeline report describing a per-URL failure. */
function synthesizeFailureReport(url: string, error: unknown): PipelineReport {
  const startedAt = Date.now();
  return {
    url,
    startedAt,
    durationMs: 0,
    initialLength: 0,
    finalLength: 0,
    returned: "none",
    result: "failed",
    steps: [],
    error: error instanceof BaseError ? error.toDiagnosticString() : "unhandled"
  };
}
