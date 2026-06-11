/** Verifies descriptor-based generic runtime builders. */
import { describe, expect, it } from "vitest";

import type { SourceProvider, SourceProviderDescriptor } from "../../src/contracts/extensions/source-provider.js";
import type { LlmProviderDescriptor } from "../../src/contracts/extensions/llm-provider.js";
import type { HttpAdapterDescriptor } from "../../src/adapters/http/adapter-contracts.js";
import type { HttpAdapterConfigEntry } from "../../src/config/app-config.js";
import type { PipelineHandle } from "../../src/contracts/pipeline/handle.js";
import type { PipelineStep, PipelineStepDescriptor } from "../../src/contracts/pipeline/step.js";
import type { EngineConfig } from "../../src/engine/engine-config.js";
import { buildHttpAdapters } from "../../src/adapters/http/build-adapters.js";
import { buildSourceProviders } from "../../src/engine/internal/builders/build-source-providers.js";
import { buildLlmProviders } from "../../src/engine/internal/builders/build-llm-providers.js";
import { buildPipelines } from "../../src/engine/internal/builders/build-pipelines.js";
import { outputRendererRegistryKey } from "../../src/contracts/extensions/output-renderer.js";
import { createExtensionServicesBuilder } from "../../src/engine/internal/extension-services.js";
import { ConfigurationError } from "../../src/shared/errors.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger } from "../helpers/logger.js";
import { makePassthroughRenderer, makePipelineResult } from "../helpers/pipeline.js";

describe("descriptor builders", () => {
  it("passes source provider config through source provider descriptors unchanged", async () => {
    const parsedConfigs: unknown[] = [];
    const rawProviders: EngineConfig["sourceProviders"] = {
      external: { type: "opaque_source_provider", config: { provider: "reserved-word", nested: { value: true } } }
    };

    const providers = buildSourceProviders(rawProviders, createTestHostTools(), createTestLogger(), {
      opaque_source_provider: {
        type: "opaque_source_provider",
        parseConfig: raw => {
          parsedConfigs.push(raw);
          return raw;
        },
        create: () => sourceProvider()
      } satisfies SourceProviderDescriptor<unknown>
    });

    // Lazy: require triggers parse+create
    const resolved = providers.require("external");
    expect(parsedConfigs).toEqual([{ provider: "reserved-word", nested: { value: true } }]);
    expect(resolved.name).toBe("external");
  });

  it("passes LLM provider config through LLM provider descriptors unchanged", async () => {
    const parsedConfigs: unknown[] = [];
    const rawProviders: EngineConfig["llmProviders"] = {
      external: { type: "opaque_llm_provider", config: { model: "reserved-word", nested: { value: true } } }
    };

    const providers = buildLlmProviders(rawProviders, createTestHostTools(), createTestLogger(), {
      opaque_llm_provider: {
        type: "opaque_llm_provider",
        parseConfig: raw => {
          parsedConfigs.push(raw);
          return raw;
        },
        create: () => ({ canFit: () => true, chat: async () => ({ text: "ok" }) })
      } satisfies LlmProviderDescriptor<unknown>
    });

    // Lazy: require triggers parse+create
    const resolved = providers.require("external");
    expect(parsedConfigs).toEqual([{ model: "reserved-word", nested: { value: true } }]);
    expect(resolved.name).toBe("external");
  });

  it("passes step config through step descriptors unchanged", async () => {
    const parsedConfigs: unknown[] = [];
    let createdStep: PipelineStep | undefined;
    const rawPipelines: EngineConfig["pipelines"] = {
      default: {
        enabled: true,
        outputRenderer: "test",
        limiters: { shared: 1 },
        steps: [
          {
            type: "opaque_step",
            name: "opaque",
            concurrencyGroup: "shared",
            timeoutSeconds: 7,
            config: { provider: "reserved-word", templates: { system: "s", user: "u" } }
          }
        ]
      }
    };

    const pipelines = await buildPipelines(
      rawPipelines,
      servicesWithRenderer(),
      createTestHostTools({ resources: resourceLoader() }),
      createTestLogger(),
      {
        opaque_step: {
          type: "opaque_step",
          parseConfig: raw => {
            parsedConfigs.push(raw);
            return raw;
          },
          create: () => {
            createdStep = Object.freeze({ run: async () => ({ status: "ok" as const }) });
            return createdStep;
          }
        } satisfies PipelineStepDescriptor<unknown>
      }
    );

    expect(parsedConfigs).toEqual([{ provider: "reserved-word", templates: { system: "s", user: "u" } }]);
    expect(pipelines.get("default")?.steps[0]).toMatchObject({
      name: "opaque",
      type: "opaque_step",
      timeoutSeconds: 7,
      concurrencyGroup: "shared"
    });
    expect(pipelines.get("default")?.steps[0]?.step).toBe(createdStep);
    expect(Object.hasOwn(createdStep ?? {}, "concurrencyGroup")).toBe(false);
  });

  it("passes HTTP adapter config through HTTP adapter descriptors unchanged", async () => {
    const parsedConfigs: unknown[] = [];
    const rawHttpAdapters: Readonly<Record<string, HttpAdapterConfigEntry>> = {
      opaque: {
        type: "opaque_adapter",
        pipeline: "default",
        config: { path: "/opaque", auth: { bearerToken: "secret" }, custom: "kept" }
      }
    };
    const pipelines = { getPipeline: (name: string) => (name === "default" ? pipelineHandle() : undefined) };

    const adapters = await buildHttpAdapters(rawHttpAdapters, pipelines, createTestHostTools(), createTestLogger(), {
      opaque_adapter: {
        type: "opaque_adapter",
        parseConfig: raw => {
          parsedConfigs.push(raw);
          return raw as { path: string };
        },
        create: () => ({ register: () => undefined })
      } satisfies HttpAdapterDescriptor<{ path: string }>
    });

    expect(parsedConfigs).toEqual([{ path: "/opaque", auth: { bearerToken: "secret" }, custom: "kept" }]);
    expect(adapters.map(adapter => adapter.name)).toEqual(["opaque"]);
    expect(adapters.map(adapter => adapter.type)).toEqual(["opaque_adapter"]);
  });

  it("rejects duplicate HTTP adapter paths", async () => {
    const rawHttpAdapters: Readonly<Record<string, HttpAdapterConfigEntry>> = {
      first: { type: "opaque_adapter", pipeline: "default", config: { path: "/same" } },
      second: { type: "other_adapter", pipeline: "default", config: { path: "/same" } }
    };
    const pipelines = { getPipeline: (name: string) => (name === "default" ? pipelineHandle() : undefined) };
    const descriptor = (type: string) =>
      ({
        type,
        parseConfig: raw => raw as { path: string },
        create: () => ({ register: () => undefined })
      }) satisfies HttpAdapterDescriptor<{ path: string }>;

    await expect(
      buildHttpAdapters(rawHttpAdapters, pipelines, createTestHostTools(), createTestLogger(), {
        opaque_adapter: descriptor("opaque_adapter"),
        other_adapter: descriptor("other_adapter")
      })
    ).rejects.toThrow("Duplicate HTTP adapter path /same: first and second");
  });

  it("wraps source provider create failures as ConfigurationError", async () => {
    const cause = new Error("factory exploded");
    const rawProviders: EngineConfig["sourceProviders"] = {
      external: { type: "opaque_source_provider", config: {} }
    };

    const providers = buildSourceProviders(rawProviders, createTestHostTools(), createTestLogger(), {
      opaque_source_provider: {
        type: "opaque_source_provider",
        parseConfig: raw => raw,
        create: () => {
          throw cause;
        }
      } satisfies SourceProviderDescriptor<unknown>
    });

    expect(() => providers.require("external")).toThrow(
      expect.objectContaining({
        code: "source_provider_create_failed",
        details: { cause, name: "external", type: "opaque_source_provider" },
        cause
      })
    );
  });

  it("wraps pipeline step create failures as ConfigurationError", async () => {
    const cause = new Error("step factory exploded");
    const rawPipelines: EngineConfig["pipelines"] = {
      default: {
        enabled: true,
        outputRenderer: "test",
        limiters: {},
        steps: [{ type: "opaque_step", name: "opaque", timeoutSeconds: 7, config: {} }]
      }
    };

    await expect(
      buildPipelines(rawPipelines, servicesWithRenderer(), createTestHostTools(), createTestLogger(), {
        opaque_step: {
          type: "opaque_step",
          parseConfig: raw => raw,
          create: () => {
            throw cause;
          }
        } satisfies PipelineStepDescriptor<unknown>
      })
    ).rejects.toMatchObject({
      code: "pipeline_step_create_failed",
      details: { cause, pipeline: "default", step: "opaque", type: "opaque_step" },
      cause
    });
  });

  it("wraps HTTP adapter create failures as ConfigurationError", async () => {
    const cause = new Error("adapter factory exploded");
    const rawHttpAdapters: Readonly<Record<string, HttpAdapterConfigEntry>> = {
      opaque: { type: "opaque_adapter", pipeline: "default", config: { path: "/opaque" } }
    };
    const pipelines = { getPipeline: (name: string) => (name === "default" ? pipelineHandle() : undefined) };

    await expect(
      buildHttpAdapters(rawHttpAdapters, pipelines, createTestHostTools(), createTestLogger(), {
        opaque_adapter: {
          type: "opaque_adapter",
          parseConfig: raw => raw as { path: string },
          create: () => {
            throw cause;
          }
        } satisfies HttpAdapterDescriptor<{ path: string }>
      })
    ).rejects.toMatchObject({
      code: "http_adapter_create_failed",
      details: { cause, name: "opaque", type: "opaque_adapter", pipeline: "default" },
      cause
    });
  });

  it("does not wrap ConfigurationError thrown by descriptor create", async () => {
    const classified = new ConfigurationError("classified failure", "classified_create_failure");
    const rawProviders: EngineConfig["sourceProviders"] = {
      external: { type: "opaque_source_provider", config: {} }
    };

    const providers = buildSourceProviders(rawProviders, createTestHostTools(), createTestLogger(), {
      opaque_source_provider: {
        type: "opaque_source_provider",
        parseConfig: raw => raw,
        create: () => {
          throw classified;
        }
      } satisfies SourceProviderDescriptor<unknown>
    });

    expect(() => providers.require("external")).toThrow(classified);
  });
});

function sourceProvider(): SourceProvider {
  return { load: async () => ({ kind: "text", content: "source", mediaType: "text/markdown" }) };
}

function resourceLoader() {
  return { configDir: "/config", readText: async () => "template" };
}

function servicesWithRenderer() {
  const renderer = makePassthroughRenderer();
  const registry = {
    require: (name: string) => {
      if (name !== "test") throw new Error(`Unknown renderer: ${name}`);
      return renderer;
    },
    tryGet: (name: string) => (name === "test" ? renderer : undefined)
  };
  const builder = createExtensionServicesBuilder();
  builder.register(outputRendererRegistryKey, registry);
  return builder.build();
}

function pipelineHandle(): PipelineHandle {
  return {
    run: async () => ({ markdown: "ok", run: makePipelineResult("ok") }),
    renderFailure: async () => "failed"
  };
}
