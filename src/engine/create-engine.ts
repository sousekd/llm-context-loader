/**
 * Constructs the programmatic engine runtime from host-provided inputs.
 *
 * This module is the engine boundary: it builds registries, registers
 * construction-time extension services, compiles configured pipelines, and
 * returns bound pipeline handles. It does not import YAML, HTTP, default
 * bundles, process bootstrap code, or concrete built-ins.
 */

import { contentTransformerRegistryKey } from "../contracts/extensions/content-transformer.js";
import { llmProviderRegistryKey } from "../contracts/extensions/llm-provider.js";
import { outputRendererRegistryKey } from "../contracts/extensions/output-renderer.js";
import { sourceProviderRegistryKey } from "../contracts/extensions/source-provider.js";
import { PipelineOrchestrator } from "../core/pipeline/orchestrator.js";
import { PipelineRunner } from "../core/pipeline/runner.js";
import { createEngineRuntime } from "./engine-runtime.js";
import { buildContentTransformers } from "./internal/builders/build-content-transformers.js";
import { buildLlmProviders } from "./internal/builders/build-llm-providers.js";
import { buildOutputRenderers } from "./internal/builders/build-output-renderers.js";
import { buildPipelines } from "./internal/builders/build-pipelines.js";
import { buildSourceProviders } from "./internal/builders/build-source-providers.js";
import { createExtensionServicesBuilder } from "./internal/extension-services.js";

import type { HostTools } from "../contracts/host/host-tools.js";
import type { Logger } from "../shared/logger.js";
import type { EngineConfig } from "./engine-config.js";
import type { EngineDescriptors } from "./engine-descriptors.js";
import type { EngineRegistries, EngineRuntime, PipelineInfo } from "./engine-runtime.js";

/** Constructs an engine runtime from host-selected descriptors and config. */
export async function createEngine(args: {
  readonly config: EngineConfig;
  readonly descriptors: EngineDescriptors;
  readonly tools: HostTools;
  readonly logger: Logger;
}): Promise<EngineRuntime> {
  const serviceBuilder = createExtensionServicesBuilder();
  const sourceProviders = buildSourceProviders(
    args.config.sourceProviders,
    args.tools,
    args.logger,
    args.descriptors.sourceProviders
  );
  serviceBuilder.register(sourceProviderRegistryKey, sourceProviders);
  const contentTransformers = buildContentTransformers(
    args.config.contentTransformers,
    args.tools,
    args.logger,
    args.descriptors.contentTransformers
  );
  serviceBuilder.register(contentTransformerRegistryKey, contentTransformers);
  const llmProviders = buildLlmProviders(
    args.config.llmProviders,
    args.tools,
    args.logger,
    args.descriptors.llmProviders
  );
  serviceBuilder.register(llmProviderRegistryKey, llmProviders);
  const outputRenderers = buildOutputRenderers(
    args.config.outputRenderers,
    args.tools,
    args.logger,
    args.descriptors.outputRenderers
  );
  serviceBuilder.register(outputRendererRegistryKey, outputRenderers);

  const services = serviceBuilder.build();
  const compiledPipelines = await buildPipelines(
    args.config.pipelines,
    services,
    args.tools,
    args.logger,
    args.descriptors.pipelineSteps
  );

  logSkipped(args.logger, "source provider", Object.keys(args.config.sourceProviders), sourceProviders.builtNames());
  logSkipped(
    args.logger,
    "content transformer",
    Object.keys(args.config.contentTransformers),
    contentTransformers.builtNames()
  );
  logSkipped(args.logger, "LLM provider", Object.keys(args.config.llmProviders), llmProviders.builtNames());
  logSkipped(args.logger, "output renderer", Object.keys(args.config.outputRenderers), outputRenderers.builtNames());

  const runner = new PipelineRunner(
    new PipelineOrchestrator({ logger: args.logger.child({ component: "orchestrator" }) })
  );
  const handles = new Map([...compiledPipelines].map(([name, pipeline]) => [name, runner.bindTo(pipeline)]));
  const registries: EngineRegistries = { sourceProviders, contentTransformers, llmProviders, outputRenderers };
  return createEngineRuntime({ registries, pipelines: pipelineInfos(args.config), handles });
}

/** Builds stable pipeline discovery info from engine config (enabled only). */
function pipelineInfos(config: EngineConfig): ReadonlyArray<PipelineInfo> {
  return Object.entries(config.pipelines)
    .filter(([, pipeline]) => pipeline.enabled)
    .map(([name, pipeline]) => ({
      name,
      outputRenderer: pipeline.outputRenderer,
      steps: pipeline.steps.map(step => ({
        name: step.name,
        type: step.type,
        timeoutSeconds: step.timeoutSeconds,
        concurrencyGroup: step.concurrencyGroup
      }))
    }));
}

/** Logs defined-but-unreferenced leaves for visibility (D7). */
function logSkipped(logger: Logger, label: string, defined: ReadonlyArray<string>, built: ReadonlySet<string>): void {
  const skipped = defined.filter(name => !built.has(name));
  if (skipped.length > 0)
    logger.info({ skipped }, `${label}s defined but not referenced by any active pipeline; skipped`);
}
