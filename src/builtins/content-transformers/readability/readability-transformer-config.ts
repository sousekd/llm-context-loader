/**
 * Parses YAML configuration for the built-in readability content transformer.
 *
 * The three knobs mirror the Readability.js suitability gate and parsing
 * limits: minContentLength and minScore feed `isProbablyReaderable`, while
 * maxElements caps the internal parse buffer as a DoS guardrail. A value of 0
 * for maxElements means unlimited.
 *
 * Environment substitution runs before this schema, so number fields use the
 * shared preprocessors to treat blank placeholders as omitted values.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const readabilityTransformerConfigSchema = z
  .object({
    minContentLength: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(140)),
    minScore: z.preprocess(emptyStringAsUndefined, z.coerce.number().min(0).default(20)),
    maxElements: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().min(0).default(0))
  })
  .strict();

/** Represents parsed readability transformer configuration. */
export type ReadabilityTransformerConfig = z.infer<typeof readabilityTransformerConfigSchema>;

/** Parses readability transformer configuration from YAML. */
export function parseReadabilityTransformerConfig(raw: unknown): ReadabilityTransformerConfig {
  return Object.freeze(readabilityTransformerConfigSchema.parse(raw));
}
