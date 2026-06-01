/**
 * Creates the root pino logger for HTTP, engine, and pipeline runtime code.
 *
 * Construction layers bind identity fields with `logger.child(...)`; runtime
 * components reuse the logger they receive and pass per-call fields inline.
 * Request correlation fields (`request_id`, `run_id`, `url`) come from the
 * AsyncLocalStorage request context and are merged into every log line by the
 * mixin installed here.
 */

import pino from "pino";

import { getRequestContext } from "./request-context.js";

/** Represents the structured logger type used throughout the service. */
export type Logger = pino.Logger;

/** Describes root logger configuration parsed from bootstrap environment. */
export interface LoggerConfig {
  readonly LOG_LEVEL: string;
  readonly LOG_PRETTY: "auto" | "true" | "false";
}

/**
 * Creates the root structured logger. Every child created from this
 * instance inherits the ALS mixin, so request-correlation fields appear
 * on every log line whenever a request scope is active. The mixin always
 * returns a fresh shallow copy so pino's per-call field merging never
 * mutates the ALS-backed request context. When `LOG_PRETTY` resolves to
 * true (explicitly `"true"`, or `"auto"` with a TTY stdout), output is
 * routed through `pino-pretty` in a worker thread for human-readable
 * terminal output. Otherwise output is line-delimited JSON.
 */
export function createLogger(config: LoggerConfig): Logger {
  const usePretty = config.LOG_PRETTY === "true" || (config.LOG_PRETTY === "auto" && process.stdout.isTTY === true);
  return pino({
    level: config.LOG_LEVEL,
    mixin: () => ({ ...(getRequestContext() ?? {}) }),
    ...(usePretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:HH:MM:ss.l",
              ignore: "pid,hostname,reqId",
              singleLine: false
            }
          }
        }
      : {})
  });
}
