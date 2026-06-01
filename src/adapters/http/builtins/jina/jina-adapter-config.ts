/**
 * Parses YAML configuration for the Jina Reader-style HTTP adapter.
 *
 * The adapter exposes both path and query URL forms under one configured base
 * path and can optionally require bearer authentication.
 */

import { z } from "zod";

const jinaConfigSchema = z
  .object({
    path: z.string().min(1).default("/r"),
    auth: z
      .object({ bearerToken: z.string().default("") })
      .strict()
      .default({})
  })
  .strict();

/** Represents parsed Jina client configuration. */
export type JinaConfig = z.infer<typeof jinaConfigSchema>;

/** Parses Jina client configuration from YAML. */
export function parseJinaConfig(raw: unknown): JinaConfig {
  return Object.freeze(jinaConfigSchema.parse(raw));
}
