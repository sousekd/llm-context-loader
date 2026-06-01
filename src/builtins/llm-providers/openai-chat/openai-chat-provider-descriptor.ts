/**
 * Exposes the OpenAI-compatible chat provider descriptor to engine bundles.
 *
 * The descriptor resolves the host HTTP fetch tool at construction time and
 * returns a behavior-only LLM provider instance. The engine registry adds YAML
 * identity separately.
 */

import { httpFetchKey } from "../../../contracts/host/host-tools.js";
import { parseOpenAiChatConfig } from "./openai-chat-provider-config.js";
import { OpenAiChatProvider } from "./openai-chat-provider.js";

import type { LlmProviderDescriptor } from "../../../contracts/extensions/llm-provider.js";
import type { OpenAiChatConfig } from "./openai-chat-provider-config.js";

/** Defines the built-in OpenAI-compatible chat provider type. */
export const openAiChatProviderDescriptor = {
  type: "openai-chat",
  parseConfig: parseOpenAiChatConfig,
  create: args =>
    new OpenAiChatProvider(args.config, {
      httpFetch: args.deps.tools.require(httpFetchKey),
      logger: args.deps.logger
    })
} satisfies LlmProviderDescriptor<OpenAiChatConfig>;
