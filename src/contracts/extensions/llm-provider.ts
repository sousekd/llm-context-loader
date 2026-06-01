/**
 * Defines the LLM provider extension contract and registry service key.
 *
 * Provider instances are behavior-only; configured identity lives in resolved
 * wrappers created by the engine. Pipeline steps resolve named providers from
 * the extension service registry during construction.
 */

import { createExtensionServiceKey } from "../host/extension-services.js";

import type { Logger } from "../../shared/logger.js";
import type { HostTools } from "../host/host-tools.js";
import type { NamedRegistry } from "./named-registry.js";
import type { ResolvedLlmProvider } from "./resolved-extension.js";

/** Enumerates chat roles supported by the provider compatibility target. */
export type LlmRole = "system" | "user";

/** Represents one chat completion message sent to an LLM provider. */
export interface LlmMessage {
  readonly role: LlmRole;
  readonly content: string;
}

/** Represents normalized text returned by an LLM provider. */
export interface LlmChatResult {
  readonly text: string;
}

/** Defines the provider port for chat completion text generation. */
export interface LlmProvider {
  /** Sends a chat completion request and returns normalized response text. */
  chat(messages: ReadonlyArray<LlmMessage>, opts: { readonly signal: AbortSignal }): Promise<LlmChatResult>;

  /**
   * Reports whether a prompt plus a reserved output budget fits the model context window.
   *
   * Implementations own the char-to-token conversion. Callers speak in characters only.
   * Providers that do not have a configured context limit should return `true`.
   */
  canFit(prompt: string, outputReserveChars: number): boolean;
}

/** Resolves configured LLM providers by name. */
export type LlmProviderRegistry = NamedRegistry<ResolvedLlmProvider>;

/** Provides dependencies available while constructing an LLM provider. */
export interface LlmProviderCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one LLM provider instance. */
export interface LlmProviderCreateArgs<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  readonly deps: LlmProviderCreateDeps;
}

/** Defines one LLM provider implementation type addressable from YAML. */
export interface LlmProviderDescriptor<TConfig = unknown> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: LlmProviderCreateArgs<TConfig>): LlmProvider | Promise<LlmProvider>;
}

/** Identifies the LLM provider registry extension service. */
export const llmProviderRegistryKey = createExtensionServiceKey<LlmProviderRegistry>({
  id: "llmc.llmProviderRegistry",
  description: "LLM provider registry"
});
