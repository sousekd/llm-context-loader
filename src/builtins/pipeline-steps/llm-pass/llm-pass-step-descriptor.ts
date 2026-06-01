/**
 * Exposes the LLM pass pipeline step descriptor to engine bundles.
 *
 * Construction resolves the configured LLM provider and eagerly loads prompt
 * template resources relative to the active config file. Runtime execution only
 * renders loaded templates and calls the provider port.
 */

import { llmProviderRegistryKey } from "../../../contracts/extensions/llm-provider.js";
import { resourceLoaderKey } from "../../../contracts/host/host-tools.js";
import { TemplateRenderer } from "../../../shared/template-renderer.js";
import { parseLlmPassStepConfig } from "./llm-pass-step-config.js";
import { LlmPassStep } from "./llm-pass-step.js";

import type { ResourceLoader } from "../../../contracts/host/host-tools.js";
import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { LlmPassStepConfig } from "./llm-pass-step-config.js";

/** Defines the built-in LLM pass step type. */
export const llmPassStepDescriptor = {
  type: "llm-pass",
  parseConfig: parseLlmPassStepConfig,
  create: async args => {
    const llm = args.services.require(llmProviderRegistryKey).require(args.config.provider).provider;
    const resources = args.deps.tools.require(resourceLoaderKey);
    const templates = await loadTemplates(resources, args.config.templates);
    return new LlmPassStep(
      {
        minInputChars: args.config.minInputChars,
        maxInputChars: args.config.maxInputChars,
        outputReserveRatio: args.config.outputReserveRatio,
        outputReserveChars: args.config.outputReserveChars,
        templates: args.config.templates
      },
      { templates, llm, logger: args.deps.logger }
    );
  }
} satisfies PipelineStepDescriptor<LlmPassStepConfig>;

/** Loads prompt templates for one LLM pass step instance. */
async function loadTemplates(
  resources: ResourceLoader,
  templates: LlmPassStepConfig["templates"]
): Promise<TemplateRenderer> {
  const loaded = new Map<string, string>();
  for (const templatePath of [templates.system, templates.user]) {
    if (!loaded.has(templatePath)) loaded.set(templatePath, await resources.readText(templatePath));
  }
  return new TemplateRenderer(loaded);
}
