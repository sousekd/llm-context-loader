/**
 * Parses YAML configuration for the built-in capture-urls pipeline step.
 *
 * The artifact name is shared with later verify-urls steps and defaults to the
 * trusted source URL inventory used by the bundled pipeline.
 */

import { z } from "zod";

const DEFAULT_ARTIFACT = "trusted-urls";

const captureUrlsStepConfigSchema = z
  .object({
    artifact: z.string().min(1).default(DEFAULT_ARTIFACT)
  })
  .strict();

/** Represents parsed YAML configuration for a capture-urls step. */
export type CaptureUrlsStepConfig = z.infer<typeof captureUrlsStepConfigSchema>;

/** Describes constructor configuration for a capture-urls step instance. */
export interface CaptureUrlsStepOptions {
  readonly artifact: string;
}

/** Parses capture-urls step configuration from YAML. */
export function parseCaptureUrlsStepConfig(raw: unknown): CaptureUrlsStepConfig {
  return Object.freeze(captureUrlsStepConfigSchema.parse(raw));
}
