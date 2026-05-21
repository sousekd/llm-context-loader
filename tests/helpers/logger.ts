import pLimit from "p-limit";
import pino from "pino";
import type { Limiters } from "../../src/core/util/limiters.js";
import type { Logger } from "../../src/core/util/logger.js";

// A pino logger pinned to the `silent` level — quiet by default but still
// the real pino API so use cases that call `.child(...)` keep working.
export function silentLogger(): Logger {
  return pino({ level: "silent" }) as unknown as Logger;
}

// Identity limiters: every concurrency cap collapses to 1 (i.e. serial).
// Tests that care about concurrency override individual slots; everything
// else just needs the call shape.
export function silentLimiters(): Limiters {
  return { fetch: pLimit(1), llm: pLimit(1) };
}
