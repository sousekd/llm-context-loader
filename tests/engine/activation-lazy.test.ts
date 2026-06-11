/** Verifies lazy provider/renderer registries (D1). */
import { describe, expect, it } from "vitest";

import { createEngine } from "../../src/engine/create-engine.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger } from "../helpers/logger.js";
import { markdownRendererDescriptor } from "./renderer-descriptor.js";

import { sourceProviderRegistryKey } from "../../src/contracts/extensions/source-provider.js";
import type { SourceProviderDescriptor } from "../../src/contracts/extensions/source-provider.js";
import type { PipelineStepDescriptor } from "../../src/contracts/pipeline/step.js";

describe("lazy provider/registry activation", () => {
  it("unused provider with missing required config does not fail startup", async () => {
    await expect(
      createEngine({
        config: {
          sourceProviders: {
            "bad-provider": { type: "validated-source", config: { requiredField: "" } }
          },
          llmProviders: {},
          outputRenderers: { markdown: { type: "markdown", config: {} } },
          pipelines: {
            default: {
              enabled: true,
              outputRenderer: "markdown",
              limiters: {},
              steps: [{ type: "static-body", name: "write", timeoutSeconds: 5, config: { content: "ok" } }]
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
          llmProviders: {},
          outputRenderers: { markdown: markdownRendererDescriptor },
          pipelineSteps: {
            "static-body": staticBodyStepDescriptor
          }
        },
        tools: createTestHostTools(),
        logger: createTestLogger()
      })
    ).resolves.toBeDefined();
  });

  it("reachable provider with missing required config fails with descriptor error", async () => {
    await expect(
      createEngine({
        config: {
          sourceProviders: {
            "bad-provider": { type: "validated-source", config: { requiredField: "" } }
          },
          llmProviders: {},
          outputRenderers: { markdown: { type: "markdown", config: {} } },
          pipelines: {
            default: {
              enabled: true,
              outputRenderer: "markdown",
              limiters: {},
              steps: [{ type: "uses-provider", name: "fetch", timeoutSeconds: 5, config: { provider: "bad-provider" } }]
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
          llmProviders: {},
          outputRenderers: { markdown: markdownRendererDescriptor },
          pipelineSteps: {
            "uses-provider": {
              type: "uses-provider",
              parseConfig: raw => raw as { provider: string },
              create: async ({ config, services }) => {
                // Step that resolves a source provider at create time.
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
    ).rejects.toThrow("Failed to create source provider 'bad-provider'");
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
