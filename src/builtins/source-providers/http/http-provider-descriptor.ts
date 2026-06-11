/**
 * Exposes the HTTP source provider descriptor to engine descriptor bundles.
 *
 * The descriptor resolves the host HTTP fetch tool at construction time and
 * returns a behavior-only provider instance; configured identity is added later
 * by engine registry construction.
 *
 * Security: this provider has no SSRF protection — see http-provider.ts
 */

import { httpFetchKey } from "../../../contracts/host/host-tools.js";
import { parseHttpConfig } from "./http-provider-config.js";
import { HttpProvider } from "./http-provider.js";

import type { SourceProviderDescriptor } from "../../../contracts/extensions/source-provider.js";
import type { HttpConfig } from "./http-provider-config.js";

/** Defines the built-in HTTP provider type. */
export const httpProviderDescriptor = {
  type: "http",
  parseConfig: parseHttpConfig,
  create: args =>
    new HttpProvider(args.config, {
      httpFetch: args.deps.tools.require(httpFetchKey),
      logger: args.deps.logger
    })
} satisfies SourceProviderDescriptor<HttpConfig>;
