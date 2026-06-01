/**
 * Propagates request-scoped correlation fields through AsyncLocalStorage.
 *
 * HTTP installs `request_id` at the inbound edge, and pipeline runs layer
 * `run_id` plus `url` over that parent scope. The logger mixin reads this
 * context on every log call, so runtime code should not copy these fields into
 * per-call log objects by hand.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { InternalError } from "./errors.js";

/**
 * Carries identifiers that correlate log lines belonging to a single
 * in-flight unit of work.
 *
 * `request_id` is set once per HTTP request. `run_id` and `url` are added
 * once per pipeline run; one request may produce many runs when multiple
 * URLs are processed concurrently.
 */
export interface RequestContext {
  readonly request_id: string;
  readonly run_id?: string;
  readonly url?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Runs `fn` inside a fresh request-context scope.
 *
 * Used at the HTTP boundary to attach `request_id` for the lifetime of one
 * request. Nested scopes are created via `withChildRequestContext`.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

/**
 * Runs `fn` inside a child scope that merges `partial` over the current
 * context. Throws when no parent scope exists, because child scopes only
 * make sense once an HTTP request has set `request_id`.
 */
export function withChildRequestContext<T>(partial: Partial<RequestContext>, fn: () => T): T {
  const current = requestContextStorage.getStore();
  if (!current)
    throw new InternalError(
      "withChildRequestContext requires an active request-context scope",
      "request_context_scope_missing"
    );
  return requestContextStorage.run({ ...current, ...partial }, fn);
}

/**
 * Returns the current request context, or `undefined` when no scope is
 * active (for example during process startup and shutdown).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Installs a request-context scope on the current async branch without
 * wrapping a callback. Intended for the Fastify `onRequest` hook, where
 * subsequent hooks and the route handler run on the same async chain
 * and inherit the store.
 */
export function enterRequestContext(ctx: RequestContext): void {
  requestContextStorage.enterWith(ctx);
}
