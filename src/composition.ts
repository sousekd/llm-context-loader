import type { ClientPlugin } from "./clients/registry.js";
import type { AppConfig } from "./config/config.js";
import type { FetchProvider } from "./core/ports/fetch-provider.js";
import type { LlmProvider } from "./core/ports/llm-provider.js";
import type { Logger } from "./core/util/logger.js";

import { parseClientList } from "./clients/registry.js";
import { TemplateRenderer } from "./core/cleanup/templates.js";
import { LlmStage, cleanConfigFromAppConfig, summarizeConfigFromAppConfig } from "./core/use-cases/llm-stage/llm-stage.js";
import { LoadContextUseCase } from "./core/use-cases/load-context.js";
import { AppError } from "./core/util/errors.js";
import { createLimiters } from "./core/util/limiters.js";
import { FirecrawlFetchProvider, parseFirecrawlEnv } from "./providers/fetch/firecrawl/index.js";
import { OpenAiChatLlmProvider, parseOpenAiChatEnv } from "./providers/llm/openai-chat/index.js";

// Composition root that wires concrete providers, stages, and client plugins.
// This is the only module that constructs provider implementations.

export interface Composition {
  config: AppConfig;
  logger: Logger;
  useCase: LoadContextUseCase;
  clients: ClientPlugin[];
}

/** Build the full application composition from config, env, and logger. */
export function compose(config: AppConfig, env: NodeJS.ProcessEnv, logger: Logger): Composition {
  const limiters = createLimiters(config);
  const templateRenderer = new TemplateRenderer(config);

  const fetchProvider = selectFetchProvider(config, env);
  const llmProvider = selectLlmProvider(config, env);

  const cleanStage = new LlmStage({
    config: cleanConfigFromAppConfig(config),
    app: config,
    llm: llmProvider,
    templates: templateRenderer
  });
  const summarizeStage = new LlmStage({
    config: summarizeConfigFromAppConfig(config),
    app: config,
    llm: llmProvider,
    templates: templateRenderer
  });

  const useCase = new LoadContextUseCase({
    config,
    logger,
    limiters,
    fetchProvider,
    cleanStage,
    summarizeStage,
    llmProviderName: llmProvider.name,
    templateRenderer
  });

  const parsed = parseClientList(config.CLIENTS);
  if (!parsed.ok) {
    throw new AppError(`Unknown client in CLIENTS: ${parsed.unknown}`, "unsupported_client", 500);
  }

  return { config, logger, useCase, clients: parsed.clients };
}

/** Select and construct the configured fetch provider implementation. */
function selectFetchProvider(config: AppConfig, env: NodeJS.ProcessEnv): FetchProvider {
  switch (config.FETCH_PROVIDER) {
    case "firecrawl":
      return new FirecrawlFetchProvider(config, parseFirecrawlEnv(env));
    default:
      throw new AppError(`Unsupported FETCH_PROVIDER: ${config.FETCH_PROVIDER}`, "unsupported_fetch_provider", 500);
  }
}

/** Select and construct the configured LLM provider implementation. */
function selectLlmProvider(config: AppConfig, env: NodeJS.ProcessEnv): LlmProvider {
  switch (config.LLM_PROVIDER) {
    case "openai_chat":
      parseOpenAiChatEnv(env);
      return new OpenAiChatLlmProvider(config);
    default:
      throw new AppError(`Unsupported LLM_PROVIDER: ${config.LLM_PROVIDER}`, "unsupported_llm_provider", 500);
  }
}
