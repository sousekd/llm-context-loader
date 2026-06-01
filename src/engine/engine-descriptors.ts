/**
 * Defines descriptor records supplied by the host to engine construction.
 *
 * The engine consumes descriptor records but never selects default built-ins by
 * itself. Bundle selection belongs to app assembly or another embedding host.
 */

import type { LlmProviderDescriptor } from "../contracts/extensions/llm-provider.js";
import type { OutputRendererDescriptor } from "../contracts/extensions/output-renderer.js";
import type { SourceProviderDescriptor } from "../contracts/extensions/source-provider.js";
import type { PipelineStepDescriptor } from "../contracts/pipeline/step.js";

/** Descriptor records needed to construct an engine runtime. */
export interface EngineDescriptors {
  readonly sourceProviders: Readonly<Record<string, SourceProviderDescriptor>>;
  readonly llmProviders: Readonly<Record<string, LlmProviderDescriptor>>;
  readonly outputRenderers: Readonly<Record<string, OutputRendererDescriptor>>;
  readonly pipelineSteps: Readonly<Record<string, PipelineStepDescriptor>>;
}
