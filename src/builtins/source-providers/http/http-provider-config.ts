/**
 * Parses YAML configuration for the built-in HTTP source provider.
 *
 * Environment substitution runs before this schema, so numeric and boolean
 * fields use shared preprocessors to treat blank placeholders as omitted values.
 *
 * The HTTP provider is a testing-only fallback that fetches the input URL
 * directly with no SSRF protection. See the security caveat in CUSTOMIZATION.md.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined, emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const httpConfigSchema = z
  .object({
    userAgent: z
      .string()
      .default("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    maxBytes: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(5_000_000)),
    titleFromHtml: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(true))
  })
  .strict();

/** Represents parsed HTTP provider configuration. */
export type HttpConfig = z.infer<typeof httpConfigSchema>;

/** Parses HTTP provider configuration from YAML. */
export function parseHttpConfig(raw: unknown): HttpConfig {
  return Object.freeze(httpConfigSchema.parse(raw));
}
