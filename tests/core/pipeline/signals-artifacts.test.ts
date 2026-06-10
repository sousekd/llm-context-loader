/** Verifies signal and artifact propagation from steps to renderer output. */
import { describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/contracts/pipeline/context.js";
import type {
  OutputRenderer,
  OutputRendererInput,
  OutputRendererResult
} from "../../../src/contracts/extensions/output-renderer.js";
import type { PipelineStep, StepResult } from "../../../src/contracts/pipeline/step.js";
import { PipelineOrchestrator } from "../../../src/core/pipeline/orchestrator.js";
import { PipelineRunner } from "../../../src/core/pipeline/runner.js";
import { createTestLogger } from "../../helpers/logger.js";
import { makePipeline } from "../../helpers/pipeline.js";

class EmittingStep implements PipelineStep {
  async run(_ctx: PipelineContext): Promise<StepResult> {
    return {
      status: "ok",
      effects: {
        body: { content: "hello", mediaType: "text/markdown" },
        signals: { tone: "friendly", score: 7 },
        artifacts: { metrics: { tokens: 42 } }
      }
    };
  }
}

class RecordingRenderer implements OutputRenderer {
  readonly type = "recording";
  readonly name = "recording";
  received?: OutputRendererInput;

  render(input: OutputRendererInput): OutputRendererResult {
    this.received = input;
    return { markdown: input.body?.content ?? "" };
  }
}

describe("pipeline signals and artifacts", () => {
  it("delivers detached, read-only maps to the renderer", async () => {
    const renderer = new RecordingRenderer();
    const pipeline = makePipeline({
      renderer,
      steps: [{ name: "emit", type: "test", timeoutSeconds: 1, step: new EmittingStep() }]
    });
    const orchestrator = new PipelineOrchestrator({ logger: createTestLogger() });
    const runner = new PipelineRunner(orchestrator);

    const output = await runner.run(pipeline, { url: "https://example.com/" });

    expect(output.markdown).toBe("hello");
    expect(renderer.received).toBeDefined();
    expect(renderer.received?.signals.get("tone")).toBe("friendly");
    expect(renderer.received?.signals.get("score")).toBe(7);
    expect(renderer.received?.artifacts.get("metrics")).toEqual({ tokens: 42 });

    expect(renderer.received?.signals).toBe(output.run.signals);
    expect(renderer.received?.artifacts).toBe(output.run.artifacts);

    expect(output.run.signals.get("tone")).toBe("friendly");
    expect(output.run.artifacts.get("metrics")).toEqual({ tokens: 42 });

    const secondOutput = await runner.run(pipeline, { url: "https://example.com/" });
    expect(secondOutput.run.signals).not.toBe(output.run.signals);
    expect(secondOutput.run.artifacts).not.toBe(output.run.artifacts);
  });
});
