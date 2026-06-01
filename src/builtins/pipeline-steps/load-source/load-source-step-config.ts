/**
 * Parses YAML configuration for the built-in load-source pipeline step.
 *
 * The step references a named source provider from the engine provider registry;
 * descriptor construction resolves that name before runtime execution begins.
 */

import { z } from "zod";

const loadSourceStepConfigSchema = z
  .object({
    provider: z.string().min(1)
  })
  .strict();

/** Represents parsed YAML configuration for a load-source step. */
export type LoadSourceStepConfig = z.infer<typeof loadSourceStepConfigSchema>;

/** Parses load-source step configuration from YAML. */
export function parseLoadSourceStepConfig(raw: unknown): LoadSourceStepConfig {
  return Object.freeze(loadSourceStepConfigSchema.parse(raw));
}
