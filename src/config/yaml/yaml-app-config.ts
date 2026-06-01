/**
 * Loads YAML configuration and translates it into the app configuration envelope.
 *
 * YAML stays a deployment configuration source. This module validates shape and
 * maps parsed declarations to `AppConfig`; it does not construct providers,
 * pipelines, renderers, or adapters.
 */

import { dirname } from "node:path";

import { ConfigurationError } from "../../shared/errors.js";
import { substituteEnv } from "./env-substitution.js";
import { readYaml } from "./read-yaml.js";
import { rawYamlConfigSchema, type RawYamlConfig } from "./yaml-config.js";

import type { AppConfig } from "../app-config.js";

/** Loads, substitutes, validates, and translates one YAML configuration file. */
export async function loadYamlAppConfig(args: {
  readonly configPath: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<{ readonly appConfig: AppConfig; readonly configDir: string }> {
  const raw = await readYaml(args.configPath);
  const substituted = substituteEnv(raw, args.env);
  const parsed = rawYamlConfigSchema.safeParse(substituted);
  if (!parsed.success)
    throw new ConfigurationError("Invalid YAML configuration shape", "invalid_yaml_config", parsed.error.flatten());
  return { appConfig: yamlToAppConfig(parsed.data), configDir: dirname(args.configPath) };
}

/** Translates parsed YAML into the app-level configuration envelope. */
export function yamlToAppConfig(yamlConfig: RawYamlConfig): AppConfig {
  return {
    engineConfig: {
      sourceProviders: yamlConfig.sourceProviders,
      llmProviders: yamlConfig.llmProviders,
      outputRenderers: yamlConfig.outputRenderers,
      pipelines: yamlConfig.pipelines
    },
    adapters: { http: yamlConfig.httpAdapters },
    metadata: { schemaVersion: yamlConfig.schemaVersion }
  };
}
