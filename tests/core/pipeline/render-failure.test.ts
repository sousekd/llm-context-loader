/** Verifies PipelineRunner synthetic failure rendering behavior. */
import { describe, expect, it } from "vitest";

import type {
  OutputRenderer,
  OutputRendererInput,
  OutputRendererResult
} from "../../../src/contracts/extensions/output-renderer.js";
import { InternalError, UpstreamError } from "../../../src/shared/errors.js";
import { PipelineOrchestrator } from "../../../src/core/pipeline/orchestrator.js";
import { PipelineRunner } from "../../../src/core/pipeline/runner.js";
import { createTestLogger } from "../../helpers/logger.js";
import { makePipeline } from "../../helpers/pipeline.js";

class CapturingRenderer implements OutputRenderer {
  readonly type = "capturing";
  readonly name = "capturing";
  received?: OutputRendererInput;

  render(input: OutputRendererInput): OutputRendererResult {
    this.received = input;
    return { markdown: `failure:${input.report.url}:${input.report.error ?? ""}` };
  }
}

class ThrowingRenderer implements OutputRenderer {
  readonly type = "throwing";
  readonly name = "throwing";

  render(): OutputRendererResult {
    throw new Error("boom");
  }
}

describe("PipelineRunner.renderFailure", () => {
  it("renders a synthetic failure report with no body, signals, or artifacts", async () => {
    const renderer = new CapturingRenderer();
    const runner = new PipelineRunner(new PipelineOrchestrator({ logger: createTestLogger() }));
    const error = new UpstreamError("nope", "upstream_bad", { upstreamStatus: 502 });

    const markdown = await runner.renderFailure(
      makePipeline({ renderer, steps: [] }),
      { url: "https://example.com/" },
      error
    );

    expect(markdown).toBe("failure:https://example.com/:upstream_error: upstream_bad");
    expect(renderer.received?.body).toBeUndefined();
    expect(renderer.received?.signals.size).toBe(0);
    expect(renderer.received?.artifacts.size).toBe(0);
    expect(renderer.received?.report).toMatchObject({
      url: "https://example.com/",
      result: "failed",
      returned: "none",
      initialLength: 0,
      finalLength: 0,
      steps: []
    });
  });

  it("wraps renderer throws as InternalError(renderer_failed)", async () => {
    const runner = new PipelineRunner(new PipelineOrchestrator({ logger: createTestLogger() }));
    const pipeline = makePipeline({ renderer: new ThrowingRenderer(), steps: [] });

    try {
      await runner.renderFailure(pipeline, { url: "https://example.com/" }, new Error("orig"));
      expect.unreachable("renderFailure should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InternalError);
      expect((error as InternalError).code).toBe("renderer_failed");
    }
  });
});
