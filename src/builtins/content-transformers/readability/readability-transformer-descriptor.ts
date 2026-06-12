/**
 * Exposes the readability content transformer descriptor to engine bundles.
 *
 * The transformer uses the Mozilla Readability library via linkedom to extract
 * article-level content from raw HTML. Construction resolves config; runtime
 * only needs the config and logger since all DOM work is in-process.
 */

import { parseReadabilityTransformerConfig } from "./readability-transformer-config.js";
import { ReadabilityTransformer } from "./readability-transformer.js";

import type { ContentTransformerDescriptor } from "../../../contracts/extensions/content-transformer.js";
import type { ReadabilityTransformerConfig } from "./readability-transformer-config.js";

/** Defines the built-in readability content transformer type. */
export const readabilityTransformerDescriptor = {
  type: "readability",
  parseConfig: parseReadabilityTransformerConfig,
  create: args => new ReadabilityTransformer(args.config, { logger: args.deps.logger })
} satisfies ContentTransformerDescriptor<ReadabilityTransformerConfig>;
