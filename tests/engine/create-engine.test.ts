/** Verifies the programmatic engine runtime boundary. */
import { describe, expect, it } from "vitest";

import type { OutputRendererDescriptor } from "../../src/contracts/extensions/output-renderer.js";
import type { PipelineStepDescriptor } from "../../src/contracts/pipeline/step.js";
import { createEngine } from "../../src/engine/create-engine.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger } from "../helpers/logger.js";
import { markdownRendererDescriptor } from "./renderer-descriptor.js";

describe("createEngine", () => {
  it("constructs, lists, and runs pipelines without YAML or HTTP", async () => {
    const engine = await createEngine({
      config: {
        sourceProviders: {},
        contentTransformers: {},
        llmProviders: {},
        outputRenderers: { markdown: { type: "markdown", config: {} } },
        pipelines: {
          default: {
            enabled: true,
            outputRenderer: "markdown",
            limiters: {},
            steps: [{ type: "static-body", name: "write_body", timeoutSeconds: 5, config: { content: "hello engine" } }]
          }
        }
      },
      descriptors: {
        sourceProviders: {},
        contentTransformers: {},
        llmProviders: {},
        outputRenderers: { markdown: markdownRendererDescriptor },
        pipelineSteps: { "static-body": staticBodyStepDescriptor }
      },
      tools: createTestHostTools(),
      logger: createTestLogger()
    });

    expect(engine.listPipelines()).toEqual([
      {
        name: "default",
        outputRenderer: "markdown",
        steps: [{ name: "write_body", type: "static-body", timeoutSeconds: 5, concurrencyGroup: undefined }]
      }
    ]);
    expect(engine.getPipeline("missing")).toBeUndefined();

    const handle = engine.getPipeline("default");
    expect(handle).toBeDefined();
    const viaHandle = await handle?.run({ url: "https://example.com/" });
    expect(viaHandle?.markdown).toBe("hello engine");

    const viaRuntime = await engine.runPipeline("default", { url: "https://example.com/again" });
    expect(viaRuntime.markdown).toBe("hello engine");
  });

  it("reports unknown pipelines clearly", async () => {
    const engine = await createEngine({
      config: { sourceProviders: {}, contentTransformers: {}, llmProviders: {}, outputRenderers: {}, pipelines: {} },
      descriptors: {
        sourceProviders: {},
        contentTransformers: {},
        llmProviders: {},
        outputRenderers: {},
        pipelineSteps: {}
      },
      tools: createTestHostTools(),
      logger: createTestLogger()
    });

    await expect(engine.runPipeline("missing", { url: "https://example.com/" })).rejects.toThrow(
      "Unknown pipeline: missing"
    );
  });
});

const staticBodyStepDescriptor = {
  type: "static-body",
  parseConfig: raw => raw as { content: string },
  create: ({ config }) => ({
    run: async () => ({
      status: "ok" as const,
      effects: { body: { kind: "text", content: config.content, mediaType: "text/markdown" } }
    })
  })
} satisfies PipelineStepDescriptor<{ content: string }>;
