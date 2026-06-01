/**
 * Parses YAML configuration for the built-in truncate pipeline step.
 *
 * A target of zero disables truncation by causing runtime execution to skip, so
 * operators can turn the final size gate off without removing the step.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const truncateStepConfigSchema = z
  .object({
    targetChars: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().default(25_000))
  })
  .strict();

/** Represents parsed YAML configuration for a truncate step. */
export type TruncateStepConfig = z.infer<typeof truncateStepConfigSchema>;

/** Describes constructor configuration for a truncate step instance. */
export interface TruncateStepOptions {
  readonly targetChars: number;
}

/** Parses truncate step configuration from YAML. */
export function parseTruncateStepConfig(raw: unknown): TruncateStepConfig {
  return Object.freeze(truncateStepConfigSchema.parse(raw));
}
