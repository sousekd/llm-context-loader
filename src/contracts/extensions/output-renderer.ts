/**
 * Defines the output renderer extension contract and registry service key.
 *
 * The runner snapshots signals and artifacts before invoking a renderer, so
 * renderers see read-only, detached pipeline state. Renderers turn completed or
 * synthetic failed reports into client-facing markdown and do not mutate runtime
 * data.
 */

import { createExtensionServiceKey } from "../host/extension-services.js";

import type { Logger } from "../../shared/logger.js";
import type { HostTools } from "../host/host-tools.js";
import type { BodyContent, ScalarValue } from "../pipeline/context.js";
import type { PipelineReport } from "../pipeline/report.js";
import type { NamedRegistry } from "./named-registry.js";
import type { ResolvedOutputRenderer } from "./resolved-extension.js";

/** Provides everything a renderer needs to produce client-facing output. */
export interface OutputRendererInput {
  readonly pipelineName: string;
  readonly body: BodyContent | undefined;
  readonly signals: ReadonlyMap<string, ScalarValue>;
  readonly artifacts: ReadonlyMap<string, unknown>;
  readonly report: PipelineReport;
}

/** Carries the rendered markdown output. */
export interface OutputRendererResult {
  readonly markdown: string;
}

/** Renders a pipeline run result as client-facing markdown. */
export interface OutputRenderer {
  /** Converts a completed pipeline report into markdown output. */
  render(input: OutputRendererInput): Promise<OutputRendererResult> | OutputRendererResult;
}

/** Resolves configured output renderers by name. */
export type OutputRendererRegistry = NamedRegistry<ResolvedOutputRenderer>;

/** Provides dependencies available while constructing an output renderer. */
export interface OutputRendererCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one output renderer instance. */
export interface OutputRendererCreateArgs<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  readonly deps: OutputRendererCreateDeps;
}

/** Defines one output renderer implementation type addressable from YAML. */
export interface OutputRendererDescriptor<TConfig = unknown> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: OutputRendererCreateArgs<TConfig>): OutputRenderer;
}

/** Identifies the output renderer registry extension service. */
export const outputRendererRegistryKey = createExtensionServiceKey<OutputRendererRegistry>({
  id: "llmc.outputRendererRegistry",
  description: "output renderer registry"
});
