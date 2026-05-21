import pLimit from "p-limit";

import type { AppConfig } from "../../config/config.js";

// Process-wide concurrency caps for outbound fetch and LLM work.
// The LLM limiter wraps the whole per-URL stage workflow as one unit.
/** Build shared limiter instances from configured concurrency settings. */
export function createLimiters(config: AppConfig) {
  return {
    fetch: pLimit(Math.max(1, config.FETCH_CONCURRENCY)),
    llm: pLimit(Math.max(1, config.LLM_CONCURRENCY))
  };
}

export type Limiters = ReturnType<typeof createLimiters>;
