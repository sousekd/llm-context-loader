/**
 * Parses YAML configuration for the OpenAI-compatible chat provider.
 *
 * One configured provider instance maps to one model. Optional context-fit
 * settings stay in character units so pipeline steps do not need tokenizer
 * knowledge.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const openAiChatConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    apiKey: z.string().default(""),
    model: z.string().min(1),
    extraBody: z.record(z.unknown()).default({}),
    contextTokens: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().optional()),
    charsPerToken: z.preprocess(emptyStringAsUndefined, z.coerce.number().positive().default(3.5)),
    safetyMarginTokens: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().default(0))
  })
  .strict();

/** Represents parsed OpenAI-compatible chat provider configuration. */
export type OpenAiChatConfig = z.infer<typeof openAiChatConfigSchema>;

/** Parses OpenAI-compatible chat provider configuration from YAML. */
export function parseOpenAiChatConfig(raw: unknown): OpenAiChatConfig {
  return Object.freeze(openAiChatConfigSchema.parse(raw));
}
