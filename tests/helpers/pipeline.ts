/** Provides shared pipeline fixtures for tests. */
import type { PipelineContext } from "../../src/contracts/pipeline/context.js";
import type { OutputRenderer } from "../../src/contracts/extensions/output-renderer.js";
import type { PipelineHandle } from "../../src/contracts/pipeline/handle.js";
import type { CompiledPipeline, CompiledPipelineStep } from "../../src/core/pipeline/compiled.js";
import type { PipelineRunResult } from "../../src/contracts/pipeline/report.js";
import type { PipelineStep, StepResult } from "../../src/contracts/pipeline/step.js";
import type { Logger } from "../../src/shared/logger.js";
import { DebugXmlRenderer } from "../../src/builtins/output-renderers/debug-xml/debug-xml-renderer.js";
import { PassthroughRenderer } from "../../src/builtins/output-renderers/passthrough/passthrough-renderer.js";
import { PipelineOrchestrator } from "../../src/core/pipeline/orchestrator.js";
import { PipelineRunner } from "../../src/core/pipeline/runner.js";
import { createTestLogger } from "./logger.js";

export class StaticBodyStep implements PipelineStep {
  constructor(private readonly content: string) {}

  async run(_ctx: PipelineContext): Promise<StepResult> {
    return { status: "ok", effects: { body: { content: this.content, title: "Test title" } } };
  }
}

export class StaticPipelineOrchestrator extends PipelineOrchestrator {
  readonly inputs: string[] = [];

  constructor(
    private readonly result: PipelineRunResult,
    logger: Logger = createTestLogger()
  ) {
    super({ logger });
  }

  override async run(_pipeline: CompiledPipeline, input: { readonly url: string }): Promise<PipelineRunResult> {
    this.inputs.push(input.url);
    return this.result;
  }
}

export function makeDebugXmlRenderer(): OutputRenderer {
  return new DebugXmlRenderer({ rootElement: "loader_info", includeSkipped: true }, { logger: createTestLogger() });
}

export function makePassthroughRenderer(): OutputRenderer {
  return new PassthroughRenderer();
}

export function makeCompiledPipelineStep(
  step: PipelineStep,
  overrides: Partial<Omit<CompiledPipelineStep, "step">> = {}
): CompiledPipelineStep {
  return {
    name: "source",
    type: "test",
    timeoutSeconds: 1,
    step,
    ...overrides
  };
}

export function makeCompiledPipeline(renderer: OutputRenderer = makeDebugXmlRenderer()): CompiledPipeline {
  return {
    name: "test",
    renderer,
    groups: new Map(),
    steps: [makeCompiledPipelineStep(new StaticBodyStep("hello"))]
  };
}

export function makePipeline(args: {
  readonly steps: CompiledPipeline["steps"];
  readonly groups?: CompiledPipeline["groups"];
  readonly renderer?: OutputRenderer;
  readonly name?: string;
}): CompiledPipeline {
  return {
    name: args.name ?? "test",
    renderer: args.renderer ?? makePassthroughRenderer(),
    groups: args.groups ?? new Map(),
    steps: args.steps
  };
}

export function makeStaticPipelineHandle(
  result: PipelineRunResult,
  pipeline: CompiledPipeline = makeCompiledPipeline()
): { handle: PipelineHandle; inputs: string[]; pipeline: CompiledPipeline } {
  const orchestrator = new StaticPipelineOrchestrator(result);
  const runner = new PipelineRunner(orchestrator);
  return { handle: runner.bindTo(pipeline), inputs: orchestrator.inputs, pipeline };
}

export function makePipelineResult(content = "hello"): PipelineRunResult {
  return {
    body: { content, title: "Test title" },
    signals: new Map(),
    artifacts: new Map(),
    report: {
      url: "https://example.com/",
      startedAt: 1,
      durationMs: 2,
      initialChars: content.length,
      finalChars: content.length,
      ratio: 1,
      returned: "source",
      result: "ok",
      bodyProducedBy: "source",
      bodyChangedBy: "source",
      steps: [{ name: "source", type: "test", status: "ok", startedAt: 1, durationMs: 2, outputChars: content.length }]
    }
  };
}

export function makeFailedPipelineResult(error = "firecrawl: scrape_retry_limit"): PipelineRunResult {
  return {
    body: undefined,
    signals: new Map(),
    artifacts: new Map(),
    report: {
      url: "https://example.com/",
      startedAt: 1,
      durationMs: 2,
      initialChars: 0,
      finalChars: 0,
      returned: "none",
      result: "failed",
      error,
      steps: [
        {
          name: "firecrawl",
          type: "load-source",
          status: "failed",
          reason: "scrape_retry_limit",
          startedAt: 1,
          durationMs: 2
        }
      ]
    }
  };
}
