/**
 * Constructs configured output renderers for the engine registry.
 *
 * The generic registry builder handles descriptor lookup, config parsing, and
 * identity wrapping. This file supplies renderer-specific error codes and
 * logger identity fields.
 */

import { buildNamedRegistry } from "./build-named-registry.js";

import type {
  OutputRendererDescriptor,
  OutputRendererRegistry
} from "../../../contracts/extensions/output-renderer.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { Logger } from "../../../shared/logger.js";
import type { EngineConfig } from "../../engine-config.js";

/** Constructs output renderers from configured output renderer entries. */
export async function buildOutputRenderers(
  rawRenderers: EngineConfig["outputRenderers"],
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, OutputRendererDescriptor>>
): Promise<OutputRendererRegistry> {
  return buildNamedRegistry({
    rawEntries: rawRenderers,
    descriptors,
    tools,
    logger,
    labels: {
      logField: "output_renderer",
      unknownTypeCode: "unknown_output_renderer_type",
      unknownTypeMessage: type => `Unknown output renderer type: ${type}`,
      invalidConfigCode: "invalid_output_renderer_config",
      invalidConfigMessage: (name, type) => `Invalid config for output renderer '${name}' of type '${type}'`,
      createFailedCode: "output_renderer_create_failed",
      createFailedMessage: (name, type) => `Failed to create output renderer '${name}' of type '${type}'`,
      missingCode: "unknown_output_renderer",
      missingMessage: name => `Unknown output renderer: ${name}`
    },
    resolve: ({ name, type }, renderer) => ({ name, type, renderer })
  });
}
