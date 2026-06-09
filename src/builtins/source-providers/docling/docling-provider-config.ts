/**
 * Parses YAML configuration for the built-in Docling source provider.
 *
 * Environment substitution runs before this schema, so boolean fields use
 * shared preprocessors to treat blank placeholders as omitted values.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined } from "../../../shared/config-coercion.js";

const doclingConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    apiKey: z.string().default(""),
    doOcr: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(true)),
    tableMode: z.enum(["fast", "accurate"]).default("accurate")
  })
  .strict();

/** Represents parsed Docling provider configuration. */
export type DoclingConfig = z.infer<typeof doclingConfigSchema>;

/** Parses Docling provider configuration from YAML. */
export function parseDoclingConfig(raw: unknown): DoclingConfig {
  return Object.freeze(doclingConfigSchema.parse(raw));
}
