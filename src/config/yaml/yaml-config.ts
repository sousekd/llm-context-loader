/**
 * Defines the coarse YAML document schema before descriptor-specific parsing.
 *
 * This layer validates top-level structure and common orchestration fields only.
 * Built-in providers, steps, renderers, and adapters parse their own `config`
 * payloads later through descriptors.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined, emptyStringAsUndefined } from "../../shared/config-coercion.js";

const providerEntrySchema = z
  .object({
    type: z.string().min(1),
    config: z.unknown().default({})
  })
  .strict();

const stepSchema = z
  .object({
    type: z.string().min(1),
    name: z.string().min(1),
    concurrencyGroup: z.string().min(1).optional(),
    timeoutSeconds: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(60)),
    config: z.unknown().default({})
  })
  .strict();

const httpAdapterSchema = z
  .object({
    type: z.string().min(1),
    pipeline: z.string().min(1),
    config: z.unknown().default({})
  })
  .strict();

/** Validates the coarse top-level YAML document before descriptor-specific parsing. */
export const rawYamlConfigSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    sourceProviders: z.record(providerEntrySchema).default({}),
    llmProviders: z.record(providerEntrySchema).default({}),
    outputRenderers: z.record(providerEntrySchema).default({}),
    pipelines: z.record(
      z
        .object({
          enabled: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().optional()),
          outputRenderer: z.string().min(1).default("passthrough"),
          limiters: z.record(z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive())).default({}),
          steps: z.array(stepSchema).default([])
        })
        .strict()
    ),
    httpAdapters: z.record(httpAdapterSchema).default({})
  })
  .strict();

/** Represents YAML configuration before translation and registry-specific parsing. */
export type RawYamlConfig = z.infer<typeof rawYamlConfigSchema>;
