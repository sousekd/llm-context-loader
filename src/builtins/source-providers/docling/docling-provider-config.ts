/**
 * Parses YAML configuration for the built-in Docling source provider.
 *
 * Environment substitution runs before this schema, so blank fields use shared
 * preprocessors. `output` stays typed because it drives the requested formats,
 * the response field read, and the returned media type. Remaining Docling
 * convert knobs flow through the shared opaque-record preprocessor.
 */

import { z } from "zod";

import { emptyStringAsUndefined, jsonStringAsObjectOrUndefined } from "../../../shared/config-coercion.js";

const doclingConfigSchema = z
  .object({
    baseUrl: z.string().min(1, "docling baseUrl is required").url("docling baseUrl must be a valid URL"),
    apiKey: z.string().default(""),
    output: z.preprocess(emptyStringAsUndefined, z.enum(["markdown", "html"]).default("markdown")),
    options: z.preprocess(jsonStringAsObjectOrUndefined, z.record(z.unknown()).default({}))
  })
  .strict();

/** Represents parsed Docling provider configuration. */
export type DoclingConfig = z.infer<typeof doclingConfigSchema>;

/** Parses Docling provider configuration from YAML. */
export function parseDoclingConfig(raw: unknown): DoclingConfig {
  return Object.freeze(doclingConfigSchema.parse(raw));
}
