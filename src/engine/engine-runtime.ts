/**
 * Defines the programmatic engine runtime boundary for adapters and embeddings.
 *
 * Adapters consume pipeline handles or call `runPipeline` by name. They do not
 * access compiled pipeline internals, registry builders, YAML declarations, or
 * concrete built-in implementations through this surface.
 */

import { ConfigurationError } from "../shared/errors.js";

import type { LlmProviderRegistry } from "../contracts/extensions/llm-provider.js";
import type { OutputRendererRegistry } from "../contracts/extensions/output-renderer.js";
import type { SourceProviderRegistry } from "../contracts/extensions/source-provider.js";
import type { PipelineInput } from "../contracts/pipeline/context.js";
import type { PipelineHandle, PipelineRunOutput } from "../contracts/pipeline/handle.js";

/** Registries of engine-owned configured runtime instances. */
export interface EngineRegistries {
  readonly sourceProviders: SourceProviderRegistry;
  readonly llmProviders: LlmProviderRegistry;
  readonly outputRenderers: OutputRendererRegistry;
}

/** Describes one configured pipeline step for discovery. */
export interface PipelineStepInfo {
  readonly name: string;
  readonly type: string;
  readonly timeoutSeconds: number;
  readonly concurrencyGroup?: string;
}

/** Describes one configured pipeline for adapters, CLIs, and future admin surfaces. */
export interface PipelineInfo {
  readonly name: string;
  readonly outputRenderer: string;
  readonly steps: ReadonlyArray<PipelineStepInfo>;
}

/** Public engine runtime surface consumed by adapters and embedded callers. */
export interface EngineRuntime {
  readonly registries: EngineRegistries;
  listPipelines(): ReadonlyArray<PipelineInfo>;
  getPipeline(name: string): PipelineHandle | undefined;
  runPipeline(name: string, input: PipelineInput): Promise<PipelineRunOutput>;
}

/** Creates an immutable engine runtime over pre-bound pipeline handles. */
export function createEngineRuntime(args: {
  readonly registries: EngineRegistries;
  readonly pipelines: ReadonlyArray<PipelineInfo>;
  readonly handles: ReadonlyMap<string, PipelineHandle>;
}): EngineRuntime {
  const pipelines = Object.freeze([...args.pipelines]);
  const handles = new Map(args.handles);
  return Object.freeze({
    registries: args.registries,
    listPipelines: () => pipelines,
    getPipeline: (name: string) => handles.get(name),
    async runPipeline(name: string, input: PipelineInput): Promise<PipelineRunOutput> {
      const handle = handles.get(name);
      if (!handle) throw new ConfigurationError(`Unknown pipeline: ${name}`, "unknown_pipeline");
      return handle.run(input);
    }
  });
}
