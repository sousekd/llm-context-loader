/**
 * Parses YAML configuration for the built-in Firecrawl source provider.
 *
 * Environment substitution runs before this schema, so blank fields use shared
 * preprocessors. `output` stays typed because it drives the requested formats,
 * the response field read, and the returned media type. Remaining Firecrawl
 * scrape knobs flow through the shared opaque-record preprocessor.
 */

import { z } from "zod";

import { emptyStringAsUndefined, jsonStringAsObjectOrUndefined } from "../../../shared/config-coercion.js";

const firecrawlConfigSchema = z
  .object({
    baseUrl: z.string().min(1, "firecrawl baseUrl is required").url("firecrawl baseUrl must be a valid URL"),
    apiKey: z.string().default(""),
    output: z.preprocess(emptyStringAsUndefined, z.enum(["markdown", "html", "rawHtml"]).default("markdown")),
    options: z.preprocess(jsonStringAsObjectOrUndefined, z.record(z.unknown()).default({}))
  })
  .strict();

/** Represents parsed Firecrawl provider configuration. */
export type FirecrawlConfig = z.infer<typeof firecrawlConfigSchema>;

/** Parses Firecrawl provider configuration from YAML. */
export function parseFirecrawlConfig(raw: unknown): FirecrawlConfig {
  return Object.freeze(firecrawlConfigSchema.parse(raw));
}
