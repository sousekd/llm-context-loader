/**
 * Parses YAML configuration for the built-in mdream content transformer.
 *
 * Environment substitution runs before this schema, so boolean fields use the
 * shared preprocessor to treat blank placeholders as omitted values. These knobs
 * tune transformer behavior per instance; routing intent (the target media type)
 * comes from the requesting step, not this config.
 *
 * Note on `minimal`: withMinimalPreset returns 0 HTML-to-markdown chars when fed
 * readability-extracted article HTML from table-heavy layouts (HN, Quora, etc.)
 * because it tries to re-extract main content from already-extracted markup.
 * Default false is safe when readability precedes mdream; use minimal=true only
 * in pipelines without a prior extraction step.
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
