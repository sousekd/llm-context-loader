/** Verifies the load-source pipeline step behavior. */
import { describe, expect, it } from "vitest";

import type { StepResult } from "../../../../src/contracts/pipeline/step.js";
import type { SourceProvider } from "../../../../src/contracts/extensions/source-provider.js";
import { LoadSourceStep } from "../../../../src/builtins/pipeline-steps/load-source/load-source-step.js";
import { UpstreamError } from "../../../../src/shared/errors.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("LoadSourceStep", () => {
  it("skips when a body already exists", async () => {
    const step = new LoadSourceStep({ sourceProvider: provider({ content: "new" }), logger: createTestLogger() });

    await expect(step.run(makeStepContext({ body: { content: "old" } }))).resolves.toMatchObject({
      status: "skipped",
      reason: "body_present"
    });
  });

  it("writes loaded content and title", async () => {
    const step = new LoadSourceStep({
      sourceProvider: provider({ content: " markdown ", title: "Title" }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result).toMatchObject({ status: "ok", diagnostics: { attributes: { title: "Title" } } });
    expect(result.effects?.body).toEqual({ content: "markdown", title: "Title" });
  });

  it("maps provider errors to load-source reason tokens", async () => {
    const upstreamFailure = await loadFailure(new UpstreamError("bad", "upstream_bad", { upstreamStatus: 429 }));
    expect(upstreamFailure).toEqual({
      status: "failed",
      reason: "upstream_bad"
    });
    await expect(loadFailure(new UpstreamError("bad", "parse_error", { upstreamStatus: 502 }))).resolves.toMatchObject({
      status: "failed",
      reason: "parse_error"
    });
    await expect(loadFailure(new UpstreamError("bad", "empty", { upstreamStatus: 502 }))).resolves.toMatchObject({
      status: "failed",
      reason: "empty"
    });
    const abort = new Error("aborted");
    abort.name = "AbortError";
    await expect(loadFailure(abort)).resolves.toMatchObject({ status: "failed", reason: "timeout" });
  });
});

function provider(document: Awaited<ReturnType<SourceProvider["load"]>>): SourceProvider {
  return { load: async () => document };
}

async function loadFailure(error: unknown): Promise<StepResult> {
  const step = new LoadSourceStep({
    sourceProvider: {
      load: async () => {
        throw error;
      }
    },
    logger: createTestLogger()
  });
  return step.run(makeStepContext());
}
