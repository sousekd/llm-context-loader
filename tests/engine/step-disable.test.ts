/** Verifies disabled-step compile-time exclusion (D1). */
import { describe, expect, it } from "vitest";

import { createEngine } from "../../src/engine/create-engine.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger, type CapturedLog } from "../helpers/logger.js";
import { markdownRendererDescriptor } from "./renderer-descriptor.js";

import { sourceProviderRegistryKey } from "../../src/contracts/extensions/source-provider.js";
import type { SourceProviderDescriptor } from "../../src/contracts/extensions/source-provider.js";
import type { PipelineStepDescriptor } from "../../src/contracts/pipeline/step.js";

describe("step disable / compile-time exclusion", () => {
  it("disabled step with invalid provider config does not fail startup", async () => {
    await expect(
      createEngine({
        config: {
          sourceProviders: {
            "bad-provider": { type: "validated-source", config: { requiredField: "" } }
          },
          contentTransformers: {},
          llmProviders: {},
          outputRenderers: { markdown: { type: "markdown", config: {} } },
          pipelines: {
            default: {
              enabled: true,
              outputRenderer: "markdown",
              limiters: {},
              steps: [
                {
                  type: "uses-provider",
                  name: "fetch",
                  enabled: false,
                  timeoutSeconds: 5,
                  config: { provider: "bad-provider" }
                },
                { type: "static-body", name: "write", timeoutSeconds: 5, config: { content: "ok" } }
              ]
            }
          }
        },
        descriptors: {
          sourceProviders: {
            "validated-source": {
              type: "validated-source",
              parseConfig: raw => raw,
              create: ({ config }) => {
                if (!config || !(config as { requiredField: string }).requiredField)
                  throw new Error("validated-source requiredField is missing");
                return { load: async () => ({ kind: "text" as const, content: "", mediaType: "text/markdown" }) };
              }
            } satisfies SourceProviderDescriptor
          },
          contentTransformers: {},
          llmProviders: {},
          outputRenderers: { markdown: markdownRendererDescriptor },
          pipelineSteps: {
            "uses-provider": {
              type: "uses-provider",
              parseConfig: raw => raw as { provider: string },
              create: async ({ config, services }) => {
                const cfg = config as { provider: string };
                services.require(sourceProviderRegistryKey).require(cfg.provider);
                return { run: async () => ({ status: "ok" as const }) };
              }
            } satisfies PipelineStepDescriptor<unknown>,
            "static-body": staticBodyStepDescriptor
          }
        },
        tools: createTestHostTools(),
        logger: createTestLogger()
      })
    ).resolves.toBeDefined();
  });

  it("disabled step is absent from compiled pipeline steps", async () => {
    const loaded = await createEngine({
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
            steps: [
              { type: "static-body", name: "should_appear", timeoutSeconds: 5, config: { content: "a" } },
              {
                type: "static-body",
                name: "should_not_appear",
                enabled: false,
                timeoutSeconds: 5,
                config: { content: "b" }
              },
              { type: "static-body", name: "also_appears", timeoutSeconds: 5, config: { content: "c" } }
            ]
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

    expect(
      loaded
        .listPipelines()
        .find(p => p.name === "default")
        ?.steps.map(s => s.name)
    ).toEqual(["should_appear", "also_appears"]);
  });

  it("disabled step with unknown type does not throw", async () => {
    await expect(
      createEngine({
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
              steps: [
                { type: "nonexistent-step-type", name: "ghost", enabled: false, timeoutSeconds: 5, config: {} },
                { type: "static-body", name: "real", timeoutSeconds: 5, config: { content: "ok" } }
              ]
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
      })
    ).resolves.toBeDefined();
  });

  it("disabled step does not participate in duplicate-name detection", async () => {
    await expect(
      createEngine({
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
              steps: [
                { type: "static-body", name: "dup", enabled: false, timeoutSeconds: 5, config: { content: "first" } },
                { type: "static-body", name: "dup", timeoutSeconds: 5, config: { content: "second" } }
              ]
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
      })
    ).resolves.toBeDefined();
  });

  it("logs steps disabled; excluded from compilation with disabled names", async () => {
    const logs: CapturedLog[] = [];
    await createEngine({
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
            steps: [
              { type: "static-body", name: "off1", enabled: false, timeoutSeconds: 5, config: { content: "a" } },
              { type: "static-body", name: "on", timeoutSeconds: 5, config: { content: "b" } },
              { type: "static-body", name: "off2", enabled: false, timeoutSeconds: 5, config: { content: "c" } }
            ]
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
      logger: createTestLogger(logs)
    });

    const disabledLog = logs.find(
      log => log.level === "info" && log.message === "steps disabled; excluded from compilation"
    );
    expect(disabledLog?.value).toEqual({ pipeline: "default", disabled: ["off1", "off2"] });
  });

  it("logs pipeline disabled; excluded from compilation for a disabled pipeline", async () => {
    const logs: CapturedLog[] = [];
    await createEngine({
      config: {
        sourceProviders: {},
        contentTransformers: {},
        llmProviders: {},
        outputRenderers: { markdown: { type: "markdown", config: {} } },
        pipelines: {
          active: {
            enabled: true,
            outputRenderer: "markdown",
            limiters: {},
            steps: [{ type: "static-body", name: "write", timeoutSeconds: 5, config: { content: "ok" } }]
          },
          parked: {
            enabled: false,
            outputRenderer: "markdown",
            limiters: {},
            steps: []
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
      logger: createTestLogger(logs)
    });

    const disabledLog = logs.find(
      log => log.level === "info" && log.message === "pipeline disabled; excluded from compilation"
    );
    expect(disabledLog?.value).toEqual({ pipeline: "parked" });
  });

  it("warns when a pipeline compiles with no enabled steps", async () => {
    const logs: CapturedLog[] = [];
    await createEngine({
      config: {
        sourceProviders: {},
        contentTransformers: {},
        llmProviders: {},
        outputRenderers: { markdown: { type: "markdown", config: {} } },
        pipelines: {
          empty: {
            enabled: true,
            outputRenderer: "markdown",
            limiters: {},
            steps: [{ type: "static-body", name: "off", enabled: false, timeoutSeconds: 5, config: { content: "a" } }]
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
      logger: createTestLogger(logs)
    });

    const warnLog = logs.find(log => log.level === "warn" && log.message === "pipeline compiled with no enabled steps");
    expect(warnLog?.value).toEqual({ pipeline: "empty" });
  });
});

const staticBodyStepDescriptor = {
  type: "static-body",
  parseConfig: (raw: unknown) => raw,
  create: ({ config }: { config: unknown }) => {
    const cfg = config as { content: string };
    return {
      run: async () => ({
        status: "ok" as const,
        effects: {
          body: { kind: "text" as const, content: cfg.content, mediaType: "text/markdown" as const }
        }
      })
    };
  }
} satisfies PipelineStepDescriptor<unknown>;
