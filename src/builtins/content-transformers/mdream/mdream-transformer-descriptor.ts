/**
 * Exposes the mdream content transformer descriptor to engine bundles.
 *
 * The transformer is a self-contained leaf with no host tool or service
 * dependencies; configured identity is added later by engine registry
 * construction.
 */

import { parseMdreamTransformerConfig } from "./mdream-transformer-config.js";
import { MdreamTransformer } from "./mdream-transformer.js";

import type { ContentTransformerDescriptor } from "../../../contracts/extensions/content-transformer.js";
import type { MdreamTransformerConfig } from "./mdream-transformer-config.js";

/** Defines the built-in mdream content transformer type. */
export const mdreamTransformerDescriptor = {
  type: "mdream",
  parseConfig: parseMdreamTransformerConfig,
  create: args => new MdreamTransformer(args.config, { logger: args.deps.logger })
} satisfies ContentTransformerDescriptor<MdreamTransformerConfig>;
