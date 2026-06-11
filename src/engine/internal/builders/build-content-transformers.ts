/**
 * Constructs configured content transformers for the engine registry.
 *
 * The generic registry builder handles descriptor lookup, config parsing, and
 * identity wrapping. This file supplies content-transformer-specific error codes
 * and logger identity fields.
 */

import { buildNamedRegistry, type BuiltNameTracking } from "./build-named-registry.js";

import type {
  ContentTransformerDescriptor,
  ContentTransformerRegistry
} from "../../../contracts/extensions/content-transformer.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { Logger } from "../../../shared/logger.js";
import type { EngineConfig } from "../../engine-config.js";

/** Constructs content transformers from configured content transformer entries. */
export function buildContentTransformers(
  rawTransformers: EngineConfig["contentTransformers"],
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, ContentTransformerDescriptor>>
): ContentTransformerRegistry & BuiltNameTracking {
  return buildNamedRegistry({
    rawEntries: rawTransformers,
    descriptors,
    tools,
    logger,
    labels: {
      logField: "content_transformer",
      unknownTypeCode: "unknown_content_transformer_type",
      unknownTypeMessage: type => `Unknown content transformer type: ${type}`,
      invalidConfigCode: "invalid_content_transformer_config",
      invalidConfigMessage: (name, type) => `Invalid config for content transformer '${name}' of type '${type}'`,
      createFailedCode: "content_transformer_create_failed",
      createFailedMessage: (name, type) => `Failed to create content transformer '${name}' of type '${type}'`,
      missingCode: "unknown_content_transformer",
      missingMessage: name => `Unknown content transformer: ${name}`
    },
    resolve: ({ name, type }, transformer) => ({ name, type, transformer })
  });
}
