/**
 * Parses YAML configuration for the built-in LLM pass pipeline step.
 *
 * LLM pass configuration owns prompt template paths, optional input size gates,
 * and character-based output reservation settings for the provider context-fit
 * check.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const templatePairSchema = z
  .object({
    system: z.string().min(1),
    user: z.string().min(1),
    vars: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
  })
  .strict();

const llmPassStepConfigSchema = z
  .object({
    provider: z.string().min(1),
    minInputChars: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().optional()),
    maxInputChars: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().optional()),
    outputReserveRatio: z.preprocess(emptyStringAsUndefined, z.coerce.number().nonnegative().optional()),
    outputReserveChars: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().optional()),
    templates: templatePairSchema
  })
  .strict();

/** Represents parsed YAML configuration for an LLM pass step. */
export type LlmPassStepConfig = z.infer<typeof llmPassStepConfigSchema>;

/** Describes constructor configuration for an LLM pass step instance. */
export interface LlmPassStepOptions {
  readonly minInputChars?: number;
  readonly maxInputChars?: number;
  readonly outputReserveRatio?: number;
  readonly outputReserveChars?: number;
  readonly templates: LlmPassStepConfig["templates"];
}

/** Parses LLM pass step configuration from YAML. */
export function parseLlmPassStepConfig(raw: unknown): LlmPassStepConfig {
  return Object.freeze(llmPassStepConfigSchema.parse(raw));
}
