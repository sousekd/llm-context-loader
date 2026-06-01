/**
 * Constructs configured LLM providers for the engine registry.
 *
 * The generic registry builder handles descriptor lookup, config parsing, and
 * identity wrapping. This file supplies LLM-provider-specific error codes and
 * logger identity fields.
 */

import { buildNamedRegistry } from "./build-named-registry.js";

import type { LlmProviderDescriptor, LlmProviderRegistry } from "../../../contracts/extensions/llm-provider.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { Logger } from "../../../shared/logger.js";
import type { EngineConfig } from "../../engine-config.js";

/** Constructs LLM providers from configured LLM provider entries. */
export async function buildLlmProviders(
  rawProviders: EngineConfig["llmProviders"],
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, LlmProviderDescriptor>>
): Promise<LlmProviderRegistry> {
  return buildNamedRegistry({
    rawEntries: rawProviders,
    descriptors,
    tools,
    logger,
    labels: {
      logField: "llm_provider",
      unknownTypeCode: "unknown_llm_provider_type",
      unknownTypeMessage: type => `Unknown LLM provider type: ${type}`,
      invalidConfigCode: "invalid_llm_provider_config",
      invalidConfigMessage: (name, type) => `Invalid config for LLM provider '${name}' of type '${type}'`,
      createFailedCode: "llm_provider_create_failed",
      createFailedMessage: (name, type) => `Failed to create LLM provider '${name}' of type '${type}'`,
      missingCode: "unknown_llm_provider",
      missingMessage: name => `Unknown LLM provider: ${name}`
    },
    resolve: ({ name, type }, provider) => ({ name, type, provider })
  });
}
