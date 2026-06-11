/**
 * Exposes the Docling source provider descriptor to engine descriptor bundles.
 *
 * The descriptor resolves the host HTTP fetch tool at construction time and
 * returns a behavior-only provider instance; configured identity is added later
 * by engine registry construction.
 */

import { httpFetchKey } from "../../../contracts/host/host-tools.js";
import { parseDoclingConfig } from "./docling-provider-config.js";
import { DoclingProvider } from "./docling-provider.js";

import type { SourceProviderDescriptor } from "../../../contracts/extensions/source-provider.js";
import type { DoclingConfig } from "./docling-provider-config.js";

/** Defines the built-in Docling provider type. */
export const doclingProviderDescriptor = {
  type: "docling",
  parseConfig: parseDoclingConfig,
  create: args =>
    new DoclingProvider(args.config, {
      httpFetch: args.deps.tools.require(httpFetchKey),
      logger: args.deps.logger
    })
} satisfies SourceProviderDescriptor<DoclingConfig>;
