/**
 * Parses the small bootstrap environment used before YAML loading.
 *
 * These values choose the config file, HTTP bind settings, and root logger
 * behavior. Provider, adapter, and pipeline settings are loaded later from YAML.
 */

import { z } from "zod";

import { emptyStringAsUndefined } from "../shared/config-coercion.js";
import { ConfigurationError } from "../shared/errors.js";

const envConfigSchema = z
  .object({
    CONFIG_FILE: z.string().min(1).default("config/llm-context-loader.yaml"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(3010)),
    LOG_LEVEL: z.string().min(1).default("info"),
    LOG_PRETTY: z.enum(["auto", "true", "false"]).default("auto")
  })
  .strip();

/** Represents parsed bootstrap environment configuration. */
export type EnvConfig = z.infer<typeof envConfigSchema>;

/** Parses process environment values used before YAML loading. */
export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = envConfigSchema.safeParse(env);
  if (!parsed.success)
    throw new ConfigurationError("Invalid bootstrap environment configuration", "invalid_env", parsed.error.flatten());
  return Object.freeze(parsed.data);
}
