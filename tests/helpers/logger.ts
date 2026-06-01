/** Provides logger fixtures for tests. */
import type { Logger } from "../../src/shared/logger.js";

export interface CapturedLog {
  readonly level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  readonly value: unknown;
  readonly message?: string;
}

export function createTestLogger(logs: CapturedLog[] = []): Logger {
  const logger = {
    child: () => logger,
    trace: (value: unknown, message?: string) => logs.push({ level: "trace", value, message }),
    debug: (value: unknown, message?: string) => logs.push({ level: "debug", value, message }),
    info: (value: unknown, message?: string) => logs.push({ level: "info", value, message }),
    warn: (value: unknown, message?: string) => logs.push({ level: "warn", value, message }),
    error: (value: unknown, message?: string) => logs.push({ level: "error", value, message }),
    fatal: (value: unknown, message?: string) => logs.push({ level: "fatal", value, message })
  };
  return logger as unknown as Logger;
}
