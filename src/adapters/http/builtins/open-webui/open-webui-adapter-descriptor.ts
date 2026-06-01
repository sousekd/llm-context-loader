/**
 * Exposes the Open WebUI HTTP adapter descriptor to the HTTP descriptor bundle.
 *
 * Construction warns when bearer auth is disabled and injects the bound pipeline
 * handle that the route uses for each URL in a batch.
 */

import { warnIfBearerAuthDisabled } from "../auth.js";
import { parseOpenWebUiConfig } from "./open-webui-adapter-config.js";
import { OpenWebUiAdapter } from "./open-webui-adapter.js";

import type { HttpAdapterDescriptor } from "../../adapter-contracts.js";
import type { OpenWebUiConfig } from "./open-webui-adapter-config.js";

/** Defines the built-in Open WebUI HTTP adapter type. */
export const openWebUiAdapterDescriptor = {
  type: "open-webui",
  parseConfig: parseOpenWebUiConfig,
  create: args => {
    warnIfBearerAuthDisabled(args.config.auth.bearerToken, args.deps.logger);
    return new OpenWebUiAdapter(args.config, {
      pipeline: args.pipeline,
      logger: args.deps.logger
    });
  }
} satisfies HttpAdapterDescriptor<OpenWebUiConfig>;
