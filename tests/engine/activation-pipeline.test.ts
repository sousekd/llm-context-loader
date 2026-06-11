/** Verifies pipeline activation, disabled-but-referenced error, active-set filtering, and D7 log. */
import { describe, expect, it } from "vitest";

import { yamlToAppConfig } from "../../src/config/yaml/yaml-app-config.js";
import { rawYamlConfigSchema } from "../../src/config/yaml/yaml-config.js";
import { createEngine } from "../../src/engine/create-engine.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger, type CapturedLog } from "../helpers/logger.js";
import { markdownRendererDescriptor } from "./renderer-descriptor.js";

import type { SourceProviderDescriptor } from "../../src/contracts/extensions/source-provider.js";
import type { PipelineStepDescriptor } from "../../src/contracts/pipeline/step.js";

describe("pipeline activation", () => {
  it("disabled-but-referenced pipeline throws clear error in yamlToAppConfig", () => {
    const raw = rawYamlConfigSchema.parse({
      schemaVersion: 1,
      outputRenderers: { markdown: { type: "markdown", config: {} } },
      pipelines: { parked: { enabled: false, outputRenderer: "markdown", limiters: {}, steps: [] } },
      httpAdapters: { owui: { type: "open-webui", pipeline: "parked", config: { path: "/" } } }
    });

    expect(() => yamlToAppConfig(raw)).toThrow(
      "Pipeline 'parked' is referenced by an HTTP adapter but disabled (enabled: false)"
    );
  });

  it("disabled pipeline does not appear in pipelineInfos or handles", async () => {
    const logs: CapturedLog[] = [];
    const engine = await createEngine({
      config: {
        sourceProviders: {},
        llmProviders: {},
        outputRenderers: { markdown: { type: "markdown", config: {} } },
        pipelines: {
          active: {
            enabled: true,
            outputRenderer: "markdown",
            limiters: {},
            steps: [{ type: "static-body", name: "write", timeoutSeconds: 5, config: { content: "hello" } }]
          },
          parked: {
            enabled: false,
            outputRenderer: "markdown",
            limiters: {},
            steps: [{ type: "static-body", name: "write", timeoutSeconds: 5, config: { content: "parked" } }]
          }
        }
      },
      descriptors: {
        sourceProviders: {},
        llmProviders: {},
        outputRenderers: { markdown: markdownRendererDescriptor },
        pipelineSteps: { "static-body": staticBodyStepDescriptor }
      },
      tools: createTestHostTools(),
      logger: createTestLogger(logs)
    });

    const pipelines = engine.listPipelines();
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0]!.name).toBe("active");
    expect(engine.getPipeline("active")).toBeDefined();
    expect(engine.getPipeline("parked")).toBeUndefined();
  });

  it("defined-but-unreferenced providers appear in D7 skipped log", async () => {
    const logs: CapturedLog[] = [];
    const sourceProv: SourceProviderDescriptor = {
      type: "never-built",
      parseConfig: () => ({}),
      create: () => ({ load: async () => ({ kind: "text" as const, content: "", mediaType: "text/markdown" }) })
    };

    await createEngine({
      config: {
        sourceProviders: { "never-used": { type: "never-built", config: {} } },
        llmProviders: {},
        outputRenderers: { markdown: { type: "markdown", config: {} } },
        pipelines: {}
      },
      descriptors: {
        sourceProviders: { "never-built": sourceProv },
        llmProviders: {},
        outputRenderers: { markdown: markdownRendererDescriptor },
        pipelineSteps: {}
      },
      tools: createTestHostTools(),
      logger: createTestLogger(logs)
    });

    const skippedLogs = logs.filter(
      log => log.level === "info" && (log.message ?? "").includes("defined but not referenced")
    );
    expect(skippedLogs.length).toBeGreaterThan(0);
    expect(skippedLogs.some(log => (log.message ?? "").includes("source provider"))).toBe(true);
    expect((skippedLogs[0]!.value as { skipped: string[] }).skipped).toContain("never-used");
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
