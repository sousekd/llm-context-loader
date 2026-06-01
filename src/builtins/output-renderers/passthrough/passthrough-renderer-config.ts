/**
 * Parses YAML configuration for the passthrough output renderer.
 *
 * Passthrough currently has no tunable options, but it still owns a schema so
 * the descriptor contract is uniform across renderer implementations.
 */

import { z } from "zod";

const passthroughRendererConfigSchema = z.object({}).strict();

/** Represents parsed config for the passthrough output renderer. */
export type PassthroughRendererConfig = z.infer<typeof passthroughRendererConfigSchema>;

/** Parses opaque YAML config for the passthrough output renderer. */
export function parsePassthroughRendererConfig(raw: unknown): PassthroughRendererConfig {
  return passthroughRendererConfigSchema.parse(raw);
}
