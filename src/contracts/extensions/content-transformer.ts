/**
 * Defines the content transformer extension contract and registry service key.
 *
 * Content transformers rewrite one pipeline body into another representation,
 * such as HTML to Markdown today and Markdown cleanup later. A transformer
 * instance may handle several source/target combinations; `supports` is its
 * capability matrix and `transform` performs the conversion. The requesting
 * step owns routing intent (the target media type) and asserts the result.
 */

import { createExtensionServiceKey } from "../host/extension-services.js";

import type { Logger } from "../../shared/logger.js";
import type { HostTools } from "../host/host-tools.js";
import type { BodyContent } from "../pipeline/context.js";
import type { NamedRegistry } from "./named-registry.js";
import type { ResolvedContentTransformer } from "./resolved-extension.js";

/** Describes the routing intent a step passes to a content transformer. */
export interface ContentTransformRequest {
  readonly targetMediaType: string;
}

/** Carries observability-only detail about one transform outcome. */
export interface ContentTransformDiagnostic {
  readonly code: string;
  readonly message?: string;
}

/** Carries the transformed body and optional diagnostics. */
export interface ContentTransformedResult {
  readonly outcome: "transformed";
  readonly body: BodyContent;
  readonly diagnostics?: ReadonlyArray<ContentTransformDiagnostic>;
}

/** Indicates the transformer chose not to transform this input (e.g. not suitable). */
export interface ContentDeclinedResult {
  readonly outcome: "declined";
  readonly reason?: string;
}

/** A content transformer may transform the body or decline. */
export type ContentTransformResult = ContentTransformedResult | ContentDeclinedResult;

/** Transforms one pipeline body representation into another. */
export interface ContentTransformer {
  /** Reports whether this instance can satisfy the requested transform. */
  supports(input: {
    readonly sourceKind: BodyContent["kind"];
    readonly sourceMediaType: string;
    readonly request: ContentTransformRequest;
  }): boolean;

  /** Transforms the body toward the requested target representation. */
  transform(
    input: { readonly url: string; readonly body: BodyContent; readonly request: ContentTransformRequest },
    opts: { readonly signal: AbortSignal }
  ): Promise<ContentTransformResult>;
}

/** Resolves configured content transformers by name. */
export type ContentTransformerRegistry = NamedRegistry<ResolvedContentTransformer>;

/** Provides dependencies available while constructing a content transformer. */
export interface ContentTransformerCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one content transformer instance. */
export interface ContentTransformerCreateArgs<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  readonly deps: ContentTransformerCreateDeps;
}

/** Defines one content transformer implementation type addressable from YAML. */
export interface ContentTransformerDescriptor<TConfig = unknown> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: ContentTransformerCreateArgs<TConfig>): ContentTransformer;
}

/** Identifies the content transformer registry extension service. */
export const contentTransformerRegistryKey = createExtensionServiceKey<ContentTransformerRegistry>({
  id: "llmc.contentTransformerRegistry",
  description: "content transformer registry"
});
