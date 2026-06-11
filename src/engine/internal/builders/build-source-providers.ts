/**
 * Constructs configured source providers for the engine registry.
 *
 * The generic registry builder handles descriptor lookup, config parsing, and
 * identity wrapping. This file supplies source-provider-specific error codes and
 * logger identity fields.
 */

import { buildNamedRegistry, type BuiltNameTracking } from "./build-named-registry.js";

import type {
  SourceProviderDescriptor,
  SourceProviderRegistry
} from "../../../contracts/extensions/source-provider.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { Logger } from "../../../shared/logger.js";
import type { EngineConfig } from "../../engine-config.js";

/** Constructs source providers from configured source provider entries. */
export function buildSourceProviders(
  rawProviders: EngineConfig["sourceProviders"],
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, SourceProviderDescriptor>>
): SourceProviderRegistry & BuiltNameTracking {
  return buildNamedRegistry({
    rawEntries: rawProviders,
    descriptors,
    tools,
    logger,
    labels: {
      logField: "source_provider",
      unknownTypeCode: "unknown_source_provider_type",
      unknownTypeMessage: type => `Unknown source provider type: ${type}`,
      invalidConfigCode: "invalid_source_provider_config",
      invalidConfigMessage: (name, type) => `Invalid config for source provider '${name}' of type '${type}'`,
      createFailedCode: "source_provider_create_failed",
      createFailedMessage: (name, type) => `Failed to create source provider '${name}' of type '${type}'`,
      missingCode: "unknown_source_provider",
      missingMessage: name => `Unknown source provider: ${name}`
    },
    resolve: ({ name, type }, provider) => ({ name, type, provider })
  });
}
