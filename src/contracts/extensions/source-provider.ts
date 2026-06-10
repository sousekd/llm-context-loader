/**
 * Defines the source provider extension contract and registry service key.
 *
 * Source providers turn an already validated URL into a typed document. Provider
 * implementations handle upstream response parsing and translate degradable
 * external failures into `UpstreamError`; steps decide how those failures affect
 * pipeline status.
 */

import { createExtensionServiceKey } from "../host/extension-services.js";

import type { Logger } from "../../shared/logger.js";
import type { HostTools } from "../host/host-tools.js";
import type { NamedRegistry } from "./named-registry.js";
import type { ResolvedSourceProvider } from "./resolved-extension.js";

/** Represents a source URL document before pipeline processing. */
export type SourceDocument =
  | {
      readonly kind: "text";
      readonly mediaType: string;
      readonly content: string;
      readonly title?: string;
      readonly truncated?: boolean;
    }
  | {
      readonly kind: "binary";
      readonly mediaType: string;
      readonly bytes: Uint8Array;
      readonly title?: string;
      readonly truncated?: boolean;
    };

/** Defines the provider port for URL-to-document retrieval. */
export interface SourceProvider {
  /** Loads a typed source document for one absolute HTTP(S) URL. */
  load(url: string, opts: { readonly signal: AbortSignal }): Promise<SourceDocument>;
}

/** Resolves configured source providers by name. */
export type SourceProviderRegistry = NamedRegistry<ResolvedSourceProvider>;

/** Provides dependencies available while constructing a source provider. */
export interface SourceProviderCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one source provider instance. */
export interface SourceProviderCreateArgs<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
  readonly deps: SourceProviderCreateDeps;
}

/** Defines one source provider implementation type addressable from YAML. */
export interface SourceProviderDescriptor<TConfig = unknown> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: SourceProviderCreateArgs<TConfig>): SourceProvider | Promise<SourceProvider>;
}

/** Identifies the source provider registry extension service. */
export const sourceProviderRegistryKey = createExtensionServiceKey<SourceProviderRegistry>({
  id: "llmc.sourceProviderRegistry",
  description: "source provider registry"
});
