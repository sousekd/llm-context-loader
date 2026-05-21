import { loadConfig, type AppConfig } from "../../src/config/config.js";

// Thin wrapper over `loadConfig` so every test funnels through one entry
// point. Production defaults already cover every required key, so tests
// only ever need to pass the keys they want to override.
export function buildTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig(overrides as NodeJS.ProcessEnv);
}
