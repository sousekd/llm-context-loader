/**
 * Aggregates the default engine descriptors used by hosted app assembly.
 *
 * Descriptor bundles are the only source files that collect multiple concrete
 * engine built-ins. The engine consumes this record when the host passes it in;
 * engine construction never imports this bundle directly.
 */

import { openAiChatProviderDescriptor } from "../builtins/llm-providers/openai-chat/openai-chat-provider-descriptor.js";
import { debugXmlRendererDescriptor } from "../builtins/output-renderers/debug-xml/debug-xml-renderer-descriptor.js";
import { passthroughRendererDescriptor } from "../builtins/output-renderers/passthrough/passthrough-renderer-descriptor.js";
import { captureUrlsStepDescriptor } from "../builtins/pipeline-steps/capture-urls/capture-urls-step-descriptor.js";
import { llmPassStepDescriptor } from "../builtins/pipeline-steps/llm-pass/llm-pass-step-descriptor.js";
import { loadSourceStepDescriptor } from "../builtins/pipeline-steps/load-source/load-source-step-descriptor.js";
import { truncateStepDescriptor } from "../builtins/pipeline-steps/truncate/truncate-step-descriptor.js";
import { verifyUrlsStepDescriptor } from "../builtins/pipeline-steps/verify-urls/verify-urls-step-descriptor.js";
import { httpProviderDescriptor } from "../builtins/source-providers/http/http-provider-descriptor.js";
import { firecrawlProviderDescriptor } from "../builtins/source-providers/firecrawl/firecrawl-provider-descriptor.js";
import { doclingProviderDescriptor } from "../builtins/source-providers/docling/docling-provider-descriptor.js";
import { createDescriptorRecord } from "../shared/descriptors.js";

import type { LlmProviderDescriptor } from "../contracts/extensions/llm-provider.js";
import type { OutputRendererDescriptor } from "../contracts/extensions/output-renderer.js";
import type { SourceProviderDescriptor } from "../contracts/extensions/source-provider.js";
import type { PipelineStepDescriptor } from "../contracts/pipeline/step.js";

/** Engine-facing descriptor bundle selected by the hosted service by default. */
export interface EngineDescriptorBundle {
  readonly sourceProviders: Readonly<Record<string, SourceProviderDescriptor>>;
  readonly llmProviders: Readonly<Record<string, LlmProviderDescriptor>>;
  readonly outputRenderers: Readonly<Record<string, OutputRendererDescriptor>>;
  readonly pipelineSteps: Readonly<Record<string, PipelineStepDescriptor>>;
}

/** Bundles the built-in engine descriptors without HTTP adapter descriptors. */
export const DEFAULT_ENGINE_DESCRIPTOR_BUNDLE: EngineDescriptorBundle = Object.freeze({
  sourceProviders: createDescriptorRecord(
    [httpProviderDescriptor, firecrawlProviderDescriptor, doclingProviderDescriptor],
    descriptor => descriptor.type
  ),
  llmProviders: createDescriptorRecord([openAiChatProviderDescriptor], descriptor => descriptor.type),
  outputRenderers: createDescriptorRecord(
    [debugXmlRendererDescriptor, passthroughRendererDescriptor],
    descriptor => descriptor.type
  ),
  pipelineSteps: createDescriptorRecord(
    [
      captureUrlsStepDescriptor,
      loadSourceStepDescriptor,
      llmPassStepDescriptor,
      truncateStepDescriptor,
      verifyUrlsStepDescriptor
    ],
    descriptor => descriptor.type
  )
});
