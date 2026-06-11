/**
 * Parses YAML configuration for the built-in mdream content transformer.
 *
 * Environment substitution runs before this schema, so boolean fields use the
 * shared preprocessor to treat blank placeholders as omitted values. These knobs
 * tune transformer behavior per instance; routing intent (the target media type)
 * comes from the requesting step, not this config.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined } from "../../../shared/config-coercion.js";

const mdreamTransformerConfigSchema = z
  .object({
    minimal: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(false)),
    clean: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(true))
  })
  .strict();

/** Represents parsed mdream transformer configuration. */
export type MdreamTransformerConfig = z.infer<typeof mdreamTransformerConfigSchema>;

/** Parses mdream transformer configuration from YAML. */
export function parseMdreamTransformerConfig(raw: unknown): MdreamTransformerConfig {
  return Object.freeze(mdreamTransformerConfigSchema.parse(raw));
}
