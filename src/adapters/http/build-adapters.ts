/**
 * Constructs configured HTTP adapter plugins from app configuration entries.
 *
 * Adapter construction validates descriptor types, bound pipeline references,
 * adapter-local config, duplicate route paths, and factory failures before the
 * Fastify app is built.
 */

import { ConfigurationError } from "../../shared/errors.js";

import type { HttpAdapterConfigEntry } from "../../config/app-config.js";
import type { HostTools } from "../../contracts/host/host-tools.js";
import type { PipelineHandle } from "../../contracts/pipeline/handle.js";
import type { Logger } from "../../shared/logger.js";
import type { HttpAdapter, HttpAdapterDescriptor } from "./adapter-contracts.js";
import type { ResolvedHttpAdapter } from "./resolved-adapter.js";

/** Resolves a configured pipeline to its adapter-facing handle. */
export interface PipelineHandleResolver {
  getPipeline(name: string): PipelineHandle | undefined;
}

/** Constructs HTTP adapter plugins from parsed HTTP adapter entries. */
export async function buildHttpAdapters(
  declarations: Readonly<Record<string, HttpAdapterConfigEntry>>,
  pipelines: PipelineHandleResolver,
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, HttpAdapterDescriptor>>
): Promise<ReadonlyArray<ResolvedHttpAdapter>> {
  const httpAdapters: ResolvedHttpAdapter[] = [];
  const paths = new Map<string, string>();
  for (const [name, declaration] of Object.entries(declarations)) {
    const descriptor = descriptors[declaration.type];
    if (!descriptor)
      throw new ConfigurationError(`Unknown HTTP adapter type: ${declaration.type}`, "unknown_http_adapter_type");
    const pipeline = pipelines.getPipeline(declaration.pipeline);
    if (!pipeline)
      throw new ConfigurationError(
        `Unknown pipeline for HTTP adapter ${name}: ${declaration.pipeline}`,
        "unknown_http_adapter_pipeline"
      );
    let parsed: ReturnType<typeof descriptor.parseConfig>;
    try {
      parsed = descriptor.parseConfig(declaration.config);
    } catch (cause) {
      if (cause instanceof ConfigurationError) throw cause;
      throw new ConfigurationError(`Invalid config for HTTP adapter '${name}'`, "invalid_http_adapter_config", {
        cause,
        name,
        type: declaration.type
      });
    }
    const existing = paths.get(parsed.path);
    if (existing)
      throw new ConfigurationError(
        `Duplicate HTTP adapter path ${parsed.path}: ${existing} and ${name}`,
        "duplicate_http_adapter_path"
      );
    paths.set(parsed.path, name);
    let adapter: HttpAdapter;
    try {
      adapter = await descriptor.create({
        name,
        type: declaration.type,
        config: parsed,
        pipeline,
        deps: { tools, logger: logger.child({ http_adapter: name, type: declaration.type }) }
      });
    } catch (cause) {
      if (cause instanceof ConfigurationError) throw cause;
      throw new ConfigurationError(`Failed to create HTTP adapter '${name}'`, "http_adapter_create_failed", {
        cause,
        name,
        type: declaration.type,
        pipeline: declaration.pipeline
      });
    }
    httpAdapters.push({ name, type: declaration.type, adapter });
  }
  return httpAdapters;
}
