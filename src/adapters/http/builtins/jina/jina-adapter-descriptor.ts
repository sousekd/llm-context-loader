/**
 * Exposes the Jina Reader-style HTTP adapter descriptor to the HTTP bundle.
 *
 * Construction warns when bearer auth is disabled and injects the bound pipeline
 * handle used by both path and query routes.
 */

import { warnIfBearerAuthDisabled } from "../auth.js";
import { parseJinaConfig } from "./jina-adapter-config.js";
import { JinaAdapter } from "./jina-adapter.js";

import type { HttpAdapterDescriptor } from "../../adapter-contracts.js";
import type { JinaConfig } from "./jina-adapter-config.js";

/** Defines the built-in Jina Reader-style HTTP adapter type. */
export const jinaAdapterDescriptor = {
  type: "jina",
  parseConfig: parseJinaConfig,
  create: args => {
    warnIfBearerAuthDisabled(args.config.auth.bearerToken, args.deps.logger);
    return new JinaAdapter(args.config, {
      pipeline: args.pipeline,
      logger: args.deps.logger
    });
  }
} satisfies HttpAdapterDescriptor<JinaConfig>;
