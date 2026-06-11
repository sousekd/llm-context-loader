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
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "text", content: "new", mediaType: "text/markdown" }),
      logger: createTestLogger()
    });

    await expect(step.run(makeStepContext({ body: { content: "old" } }))).resolves.toMatchObject({
      status: "skipped",
      reason: "body_present"
    });
  });

  it("writes loaded content and title", async () => {
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "text", content: " markdown ", mediaType: "text/markdown", title: "Title" }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result).toMatchObject({ status: "ok", diagnostics: { attributes: { title: "Title" } } });
    expect(result.effects?.body).toEqual({
      kind: "text",
      content: "markdown",
      mediaType: "text/markdown",
      title: "Title"
    });
  });

  it("degrades and still writes the body when the provider truncated content", async () => {
    const step = new LoadSourceStep({
      sourceProvider: provider({
        kind: "text",
        content: " markdown ",
        mediaType: "text/markdown",
        title: "Title",
        truncated: true
      }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result).toMatchObject({
      status: "degraded",
      reason: "truncated",
      diagnostics: { attributes: { title: "Title" } }
    });
    expect(result.effects?.body).toEqual({
      kind: "text",
      content: "markdown",
      mediaType: "text/markdown",
      title: "Title"
    });
  });

  it("stays ok when the provider reports truncated false", async () => {
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "text", content: "markdown", mediaType: "text/markdown", truncated: false }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result.status).toBe("ok");
    expect(result.reason).toBeUndefined();
  });

  it("writes loaded binary content", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "binary", bytes, mediaType: "application/pdf" }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result).toMatchObject({ status: "ok" });
    expect(result.effects?.body).toEqual({ kind: "binary", bytes, mediaType: "application/pdf" });
  });

  it("degrades and still writes binary content when the provider truncated bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "binary", bytes, mediaType: "application/octet-stream", truncated: true }),
      logger: createTestLogger()
    });

    const result = await step.run(makeStepContext());

    expect(result).toMatchObject({ status: "degraded", reason: "truncated" });
    expect(result.effects?.body).toEqual({ kind: "binary", bytes, mediaType: "application/octet-stream" });
  });

  it("fails empty binary content", async () => {
    const step = new LoadSourceStep({
      sourceProvider: provider({ kind: "binary", bytes: new Uint8Array(), mediaType: "application/pdf" }),
      logger: createTestLogger()
    });

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "failed", reason: "empty" });
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
