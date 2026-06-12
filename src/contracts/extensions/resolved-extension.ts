/**
 * Pairs behavior-only engine extension instances with configured identity.
 *
 * Runtime interfaces such as `SourceProvider`, `LlmProvider`, and
 * `OutputRenderer` do not expose `name` or `type`. Engine construction wraps
 * each instance so registries and future inspection surfaces can enumerate YAML
 * identities without coupling implementations to app configuration.
 */

import type { ContentTransformer } from "./content-transformer.js";
import type { LlmProvider } from "./llm-provider.js";
import type { OutputRenderer } from "./output-renderer.js";
import type { SourceProvider } from "./source-provider.js";

/** Pairs a configured source provider instance with its identity. */
export interface ResolvedSourceProvider {
  readonly name: string;
  readonly type: string;
  readonly provider: SourceProvider;
}

/** Pairs a configured content transformer instance with its identity. */
export interface ResolvedContentTransformer {
  readonly name: string;
  readonly type: string;
  readonly transformer: ContentTransformer;
}

/** Pairs a configured LLM provider instance with its identity. */
export interface ResolvedLlmProvider {
  readonly name: string;
  readonly type: string;
  readonly provider: LlmProvider;
}

/** Pairs a configured output renderer instance with its identity. */
export interface ResolvedOutputRenderer {
  readonly name: string;
  readonly type: string;
  readonly renderer: OutputRenderer;
}
