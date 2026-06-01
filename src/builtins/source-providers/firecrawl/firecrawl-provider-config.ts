/**
 * Parses YAML configuration for the built-in Firecrawl source provider.
 *
 * Environment substitution runs before this schema, so numeric and boolean
 * fields use shared preprocessors to treat blank placeholders as omitted values.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined, emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const firecrawlConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    apiKey: z.string().default(""),
    onlyMainContent: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(true)),
    formats: z.array(z.string().min(1)).default(["markdown"]),
    maxAge: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().default(0))
  })
  .strict();

/** Represents parsed Firecrawl provider configuration. */
export type FirecrawlConfig = z.infer<typeof firecrawlConfigSchema>;

/** Parses Firecrawl provider configuration from YAML. */
export function parseFirecrawlConfig(raw: unknown): FirecrawlConfig {
  return Object.freeze(firecrawlConfigSchema.parse(raw));
}
