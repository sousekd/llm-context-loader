/**
 * Exposes the Firecrawl source provider descriptor to engine descriptor bundles.
 *
 * The descriptor resolves the host HTTP fetch tool at construction time and
 * returns a behavior-only provider instance; configured identity is added later
 * by engine registry construction.
 */

import { httpFetchKey } from "../../../contracts/host/host-tools.js";
import { parseFirecrawlConfig } from "./firecrawl-provider-config.js";
import { FirecrawlProvider } from "./firecrawl-provider.js";

import type { SourceProviderDescriptor } from "../../../contracts/extensions/source-provider.js";
import type { FirecrawlConfig } from "./firecrawl-provider-config.js";

/** Defines the built-in Firecrawl provider type. */
export const firecrawlProviderDescriptor = {
  type: "firecrawl",
  parseConfig: parseFirecrawlConfig,
  create: args =>
    new FirecrawlProvider(args.config, {
      httpFetch: args.deps.tools.require(httpFetchKey),
      logger: args.deps.logger
    })
} satisfies SourceProviderDescriptor<FirecrawlConfig>;
