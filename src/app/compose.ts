/**
 * Composes the hosted service runtime from environment, YAML, descriptors, and tools.
 *
 * App assembly is the boundary that selects default descriptor bundles, creates
 * host tools, calls `createEngine`, and binds configured HTTP adapters to engine
 * pipeline handles.
 */

import { resolve } from "node:path";

import { buildHttpAdapters } from "../adapters/http/build-adapters.js";
import { DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE } from "../adapters/http/descriptor-bundle.js";
import { DEFAULT_ENGINE_DESCRIPTOR_BUNDLE } from "../bundles/default-engine-descriptors.js";
import { loadYamlAppConfig } from "../config/yaml/yaml-app-config.js";
import { httpFetchKey, resourceLoaderKey } from "../contracts/host/host-tools.js";
import { createEngine } from "../engine/create-engine.js";
import { createHostToolsBuilder } from "./host-tools.js";
import { createResourceLoader } from "./resources.js";

import type { HttpAdapterDescriptor } from "../adapters/http/adapter-contracts.js";
import type { ResolvedHttpAdapter } from "../adapters/http/resolved-adapter.js";
import type { AppConfig } from "../config/app-config.js";
import type { EnvConfig } from "../config/env-config.js";
import type { LlmProviderRegistry } from "../contracts/extensions/llm-provider.js";
import type { OutputRendererRegistry } from "../contracts/extensions/output-renderer.js";
import type { SourceProviderRegistry } from "../contracts/extensions/source-provider.js";
import type { HostTools } from "../contracts/host/host-tools.js";
import type { EngineDescriptors } from "../engine/engine-descriptors.js";
import type { EngineRuntime, PipelineInfo } from "../engine/engine-runtime.js";
import type { Logger } from "../shared/logger.js";

/** Describes all runtime pieces loaded from YAML configuration. */
export interface ComposedApp {
  readonly adapters: {
    readonly http: ReadonlyArray<ResolvedHttpAdapter>;
  };
  readonly registries: {
    readonly sourceProviders: SourceProviderRegistry;
    readonly llmProviders: LlmProviderRegistry;
    readonly outputRenderers: OutputRendererRegistry;
    readonly pipelines: ReadonlyArray<PipelineInfo>;
  };
}

/** Loads the configured YAML file and constructs all runtime instances. */
export async function composeApp(args: {
  readonly envConfig: EnvConfig;
  readonly env: NodeJS.ProcessEnv;
  readonly logger: Logger;
  readonly httpFetch: typeof globalThis.fetch;
  readonly engineDescriptors?: EngineDescriptors;
  readonly httpAdapterDescriptors?: Readonly<Record<string, HttpAdapterDescriptor>>;
}): Promise<ComposedApp> {
  const engineDescriptors = args.engineDescriptors ?? DEFAULT_ENGINE_DESCRIPTOR_BUNDLE;
  const httpAdapterDescriptors = args.httpAdapterDescriptors ?? DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE;
  const { appConfig, configDir } = await loadYamlAppConfig({
    configPath: resolve(args.envConfig.CONFIG_FILE),
    env: args.env
  });
  const tools = buildHostTools({ configDir, httpFetch: args.httpFetch });
  const engine = await createEngine({
    config: appConfig.engineConfig,
    descriptors: engineDescriptors,
    tools,
    logger: args.logger
  });
  const httpAdapters = await buildAdapterPhase(appConfig, engine, tools, args.logger, httpAdapterDescriptors);
  return {
    adapters: { http: httpAdapters },
    registries: { ...engine.registries, pipelines: engine.listPipelines() }
  };
}

/** Registers the bundled host tools and returns the immutable bag. */
function buildHostTools(args: { readonly configDir: string; readonly httpFetch: typeof globalThis.fetch }): HostTools {
  const toolsBuilder = createHostToolsBuilder();
  toolsBuilder.register(resourceLoaderKey, createResourceLoader(args.configDir));
  toolsBuilder.register(httpFetchKey, args.httpFetch);
  return toolsBuilder.build();
}

/** Builds resolved HTTP adapters bound to their configured pipelines. */
async function buildAdapterPhase(
  appConfig: AppConfig,
  engine: EngineRuntime,
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, HttpAdapterDescriptor>>
): Promise<ReadonlyArray<ResolvedHttpAdapter>> {
  return buildHttpAdapters(appConfig.adapters.http, engine, tools, logger, descriptors);
}
