/**
 * Wraps concurrency limiters used by the pipeline orchestrator.
 *
 * The orchestrator shares one limiter acquisition across adjacent steps in the
 * same concurrency group. This adapter keeps the core runtime independent of
 * the concrete `p-limit` package and gives limiter waiting the same AbortError
 * shape as fetch-compatible APIs.
 */

import pLimit from "p-limit";

/** Defines the limiter contract used around concurrent pipeline work. */
export interface ConcurrencyLimiter {
  acquire<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T>;
}

/** Adapts `p-limit` to the abort-aware concurrency contract. */
class PLimitConcurrencyLimiter implements ConcurrencyLimiter {
  private readonly limit: ReturnType<typeof pLimit>;

  /** Creates a limiter with a positive maximum concurrency. */
  constructor(concurrency: number) {
    this.limit = pLimit(Math.max(1, Math.floor(concurrency)));
  }

  /** Runs a callback under the limiter unless the wait is aborted. */
  async acquire<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) throw abortError();

    let abortListener: (() => void) | undefined;
    const abortPromise = new Promise<never>((_resolve, reject) => {
      abortListener = () => reject(abortError());
      signal.addEventListener("abort", abortListener, { once: true });
    });
    const limited = this.limit(async () => {
      if (signal.aborted) throw abortError();
      return fn();
    });

    try {
      return await Promise.race([limited, abortPromise]);
    } finally {
      if (abortListener) signal.removeEventListener("abort", abortListener);
    }
  }
}

/** Creates the abort error shape emitted by fetch-compatible APIs. */
function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

/** Creates a p-limit backed concurrency limiter. */
export function createConcurrencyLimiter(concurrency: number): ConcurrencyLimiter {
  return new PLimitConcurrencyLimiter(concurrency);
}
