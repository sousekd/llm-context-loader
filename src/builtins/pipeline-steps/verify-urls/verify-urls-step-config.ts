/**
 * Parses YAML configuration for the built-in verify-urls pipeline step.
 *
 * The step compares current body URLs against a captured artifact and either
 * reports hallucinations or rolls the body back while still returning a failed
 * step result for diagnostics and pipeline rollup.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const DEFAULT_ARTIFACT = "trusted-urls";

/** Enumerates the supported reactions when hallucinated URLs are detected. */
export const HALLUCINATION_MODES = ["report", "rollback"] as const;

/** Names one supported reaction to detected hallucinated URLs. */
export type HallucinationMode = (typeof HALLUCINATION_MODES)[number];

const verifyUrlsStepConfigSchema = z
  .object({
    artifact: z.string().min(1).default(DEFAULT_ARTIFACT),
    onHallucination: z.enum(HALLUCINATION_MODES).default("report"),
    maxReportedUrls: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().nonnegative().optional())
  })
  .strict();

/** Represents parsed YAML configuration for a verify-urls step. */
export type VerifyUrlsStepConfig = z.infer<typeof verifyUrlsStepConfigSchema>;

/** Describes constructor configuration for a verify-urls step instance. */
export interface VerifyUrlsStepOptions {
  readonly artifact: string;
  readonly onHallucination: HallucinationMode;
  readonly maxReportedUrls?: number;
}

/** Parses verify-urls step configuration from YAML. */
export function parseVerifyUrlsStepConfig(raw: unknown): VerifyUrlsStepConfig {
  return Object.freeze(verifyUrlsStepConfigSchema.parse(raw));
}
