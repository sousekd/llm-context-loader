/** Verifies the transform pipeline step routing, honesty gate, and diagnostics. */
import { describe, expect, it } from "vitest";

import { TransformStep } from "../../../../src/builtins/pipeline-steps/transform/transform-step.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

import type {
  ContentTransformer,
  ContentTransformResult
} from "../../../../src/contracts/extensions/content-transformer.js";
import type { TransformStepOptions } from "../../../../src/builtins/pipeline-steps/transform/transform-step-config.js";

const baseConfig: TransformStepOptions = {
  target: "text/markdown",
  onUnsupported: "skip",
  onDeclined: "skip",
  emitDiagnostics: false
};
const markdownResult: ContentTransformResult = {
  outcome: "transformed",
  body: { kind: "text", mediaType: "text/markdown", content: "# md" }
};

function declinedResult(reason?: string): ContentTransformResult {
  return { outcome: "declined", reason };
}

function fakeTransformer(overrides: Partial<ContentTransformer> = {}): ContentTransformer {
  return {
    supports: () => true,
    transform: async () => markdownResult,
    ...overrides
  };
}

function makeStep(config: TransformStepOptions, transformer: ContentTransformer): TransformStep {
  return new TransformStep(config, { transformer, logger: createTestLogger() });
}

const htmlBody = { content: "<h1>md</h1>", mediaType: "text/html" };

describe("TransformStep", () => {
  it("skips when there is no body", async () => {
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        supports: () => {
          throw new Error("supports must not be called without a body");
        }
      })
    );

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "skipped", reason: "no_body" });
  });

  it("skips an unsupported body when onUnsupported is skip", async () => {
    const step = makeStep(baseConfig, fakeTransformer({ supports: () => false }));

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "skipped",
      reason: "unsupported"
    });
  });

  it("fails an unsupported body when onUnsupported is fail", async () => {
    const step = makeStep({ ...baseConfig, onUnsupported: "fail" }, fakeTransformer({ supports: () => false }));

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "failed",
      reason: "unsupported"
    });
  });

  it("applies the transformed body on success without diagnostics by default", async () => {
    const step = makeStep(baseConfig, fakeTransformer());

    const result = await step.run(makeStepContext({ body: htmlBody }));

    expect(result.status).toBe("ok");
    expect(result.effects?.body).toEqual({ kind: "text", mediaType: "text/markdown", content: "# md" });
    expect(result.diagnostics).toBeUndefined();
  });

  it("passes the url and requested target to the transformer", async () => {
    let captured: { url: string; request: { targetMediaType: string } } | undefined;
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        transform: async input => {
          captured = { url: input.url, request: input.request };
          return markdownResult;
        }
      })
    );

    await step.run(makeStepContext({ body: htmlBody, url: "https://example.com/page" }));

    expect(captured).toEqual({ url: "https://example.com/page", request: { targetMediaType: "text/markdown" } });
  });

  it("surfaces transformer diagnostics as children when emitDiagnostics is true", async () => {
    const step = makeStep(
      { ...baseConfig, emitDiagnostics: true },
      fakeTransformer({
        transform: async () => ({
          outcome: "transformed",
          body: markdownResult.body,
          diagnostics: [{ code: "mdream", message: "10 -> 4" }, { code: "empty_output" }]
        })
      })
    );

    const result = await step.run(makeStepContext({ body: htmlBody }));

    expect(result.diagnostics).toEqual({
      children: [
        { name: "mdream", attributes: { message: "10 -> 4" } },
        { name: "empty_output", attributes: undefined }
      ]
    });
  });

  it("fails when the transformer returns a different media type", async () => {
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        transform: async () => ({
          outcome: "transformed",
          body: { kind: "text", mediaType: "text/plain", content: "x" }
        })
      })
    );

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "failed",
      reason: "wrong_output_type"
    });
  });

  it("fails when the transformer returns the wrong representation for a text target", async () => {
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        transform: async () => ({
          outcome: "transformed",
          body: { kind: "binary", mediaType: "text/markdown", bytes: new Uint8Array([1]) }
        })
      })
    );

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "failed",
      reason: "wrong_output_type"
    });
  });

  it("maps an abort during transform to a timeout failure", async () => {
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        transform: async () => {
          throw new DOMException("Aborted", "AbortError");
        }
      })
    );

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "failed",
      reason: "timeout"
    });
  });

  it("skips when the transformer declines with onDeclined default skip", async () => {
    const step = makeStep(baseConfig, fakeTransformer({ transform: async () => declinedResult("not_readerable") }));

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "skipped",
      reason: "not_readerable"
    });
  });

  it("fails when the transformer declines with onDeclined fail", async () => {
    const step = makeStep(
      { ...baseConfig, onDeclined: "fail" },
      fakeTransformer({ transform: async () => declinedResult("not_readerable") })
    );

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "failed",
      reason: "not_readerable"
    });
  });

  it("surfaces a default declined reason when the transformer omits the reason", async () => {
    const step = makeStep(baseConfig, fakeTransformer({ transform: async () => declinedResult() }));

    await expect(step.run(makeStepContext({ body: htmlBody }))).resolves.toMatchObject({
      status: "skipped",
      reason: "declined"
    });
  });

  it("rethrows non-abort transformer errors", async () => {
    const step = makeStep(
      baseConfig,
      fakeTransformer({
        transform: async () => {
          throw new Error("boom");
        }
      })
    );

    await expect(step.run(makeStepContext({ body: htmlBody }))).rejects.toThrow("boom");
  });
});
