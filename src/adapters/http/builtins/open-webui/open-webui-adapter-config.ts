/**
 * Parses YAML configuration for the Open WebUI external web loader adapter.
 *
 * The adapter exposes one POST route, optional bearer auth, and a per-request
 * maximum URL count for batch isolation.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../../../../shared/config-coercion.js";

const openWebUiConfigSchema = z
  .object({
    path: z.string().min(1).default("/"),
    maxUrls: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(20)),
    auth: z
      .object({ bearerToken: z.string().default("") })
      .strict()
      .default({})
  })
  .strict();

/** Represents parsed Open WebUI client configuration. */
export type OpenWebUiConfig = z.infer<typeof openWebUiConfigSchema>;

/** Parses Open WebUI client configuration from YAML. */
export function parseOpenWebUiConfig(raw: unknown): OpenWebUiConfig {
  return Object.freeze(openWebUiConfigSchema.parse(raw));
}
