import pino from "pino";

import type { AppConfig } from "../../config/config.js";

// Logger factory for the service process.
// Centralizes pino defaults used by composition and HTTP startup.
/** Build the shared process logger configured from AppConfig. */
export function createLogger(config: AppConfig) {
  return pino({
    level: config.LOG_LEVEL,
    base: undefined
  });
}

export type Logger = ReturnType<typeof createLogger>;
