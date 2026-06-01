/** Verifies bundled engine descriptor entries. */
import { describe, expect, it } from "vitest";

import type { LlmProvider, LlmProviderRegistry } from "../../src/contracts/extensions/llm-provider.js";
import type { ResourceLoader } from "../../src/contracts/host/host-tools.js";
import type { SourceProvider, SourceProviderRegistry } from "../../src/contracts/extensions/source-provider.js";
import { DEFAULT_ENGINE_DESCRIPTOR_BUNDLE } from "../../src/bundles/default-engine-descriptors.js";
import { llmProviderRegistryKey } from "../../src/contracts/extensions/llm-provider.js";
import { sourceProviderRegistryKey } from "../../src/contracts/extensions/source-provider.js";
import { createExtensionServicesBuilder } from "../../src/engine/internal/extension-services.js";
import { createTestHostTools } from "../helpers/host-tools.js";
import { createTestLogger } from "../helpers/logger.js";

describe("default engine descriptor bundle", () => {
  it("round-trips provider descriptors through parse and create", async () => {
    const firecrawl = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.sourceProviders.firecrawl;
    const firecrawlConfig = firecrawl.parseConfig({ baseUrl: "https://firecrawl.example" });
    const firecrawlProvider = await firecrawl.create({
      name: "default-firecrawl",
      config: firecrawlConfig,
      deps: { tools: createTestHostTools({ httpFetch: async () => new Response("{}") }), logger: createTestLogger() }
    });

    const openAi = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.llmProviders["openai-chat"];
    const openAiConfig = openAi.parseConfig({ baseUrl: "https://llm.example/v1", model: "model" });
    const openAiProvider = await openAi.create({
      name: "default-llm",
      config: openAiConfig,
      deps: { tools: createTestHostTools({ httpFetch: async () => new Response("{}") }), logger: createTestLogger() }
    });

    expect(firecrawlProvider.load).toEqual(expect.any(Function));
    expect(openAiProvider.chat).toEqual(expect.any(Function));
  });

  it("round-trips step descriptors through parse and create", async () => {
    const services = servicesWithProviders(sourceProvider(), llmProvider());
    const deps = {
      tools: createTestHostTools({ resources: templateResourceLoader() }),
      logger: createTestLogger()
    };

    const loadSourceConfig = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps["load-source"].parseConfig({
      provider: "source-provider"
    });
    const loadSourceStep = await DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps["load-source"].create({
      name: "source",
      type: "load-source",
      timeoutSeconds: 60,
      config: loadSourceConfig,
      services,
      deps
    });
    const llmConfig = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps["llm-pass"].parseConfig({
      provider: "llm-provider",
      templates: { system: "system", user: "user" }
    });
    const llmStep = await DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps["llm-pass"].create({
      name: "clean",
      type: "llm-pass",
      timeoutSeconds: 60,
      config: llmConfig,
      services,
      deps
    });
    const truncateConfig = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps.truncate.parseConfig({ targetChars: 100 });
    const truncateStep = await DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps.truncate.create({
      name: "truncate",
      type: "truncate",
      timeoutSeconds: 60,
      config: truncateConfig,
      services,
      deps
    });

    expect(loadSourceStep.run).toEqual(expect.any(Function));
    expect(llmStep.run).toEqual(expect.any(Function));
    expect(truncateStep.run).toEqual(expect.any(Function));
  });
});

function sourceProvider(): SourceProvider {
  return { load: async () => ({ content: "source" }) };
}

function llmProvider(): LlmProvider {
  return { canFit: () => true, chat: async () => ({ text: "clean" }) };
}

function servicesWithProviders(sourceProvider: SourceProvider, llmProvider: LlmProvider) {
  const builder = createExtensionServicesBuilder();
  builder.register(sourceProviderRegistryKey, providerRegistry("source-provider", sourceProvider));
  builder.register(llmProviderRegistryKey, providerRegistry("llm-provider", llmProvider));
  return builder.build();
}

function providerRegistry<TProvider>(
  expectedName: string,
  provider: TProvider
): SourceProviderRegistry | LlmProviderRegistry {
  const wrap = (p: TProvider) => ({ name: expectedName, type: "test", provider: p });
  return {
    require: (name: string) => {
      if (name !== expectedName) throw new Error(`Unknown provider: ${name}`);
      return wrap(provider) as never;
    },
    tryGet: (name: string) => (name === expectedName ? (wrap(provider) as never) : undefined)
  };
}

function templateResourceLoader(): ResourceLoader {
  return {
    configDir: "/config",
    readText: async path => (path === "system" ? "S" : "U")
  };
}
