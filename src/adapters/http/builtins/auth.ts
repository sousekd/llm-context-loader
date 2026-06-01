/**
 * Provides per-adapter bearer authentication helpers for HTTP routes.
 *
 * Empty adapter tokens intentionally leave the route open. Non-empty tokens are
 * compared with constant-time equality for equal-length values at the auth
 * security boundary.
 */

import { timingSafeEqual } from "node:crypto";

import { ClientError } from "../../../shared/errors.js";

import type { FastifyRequest } from "fastify";

import type { Logger } from "../../../shared/logger.js";

/** Describes bearer token authentication settings for an adapter route. */
export interface BearerAuthConfig {
  readonly token: string;
}

/** Validates the Authorization bearer token in constant-time. */
export function enforceBearerAuth(authConfig: BearerAuthConfig | undefined, request: FastifyRequest): void {
  if (!authConfig) return;
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new ClientError("Missing bearer token", "unauthorized", 401);
  const supplied = header.slice("Bearer ".length);
  if (!constantTimeEquals(supplied, authConfig.token))
    throw new ClientError("Invalid bearer token", "unauthorized", 401);
}

/** Logs when an adapter route has bearer authentication disabled. */
export function warnIfBearerAuthDisabled(token: string, logger: Logger): void {
  if (!token) logger.warn({}, "Adapter bearer auth is disabled.");
}

/** Compares bearer tokens with constant-time byte comparison for equal lengths. */
function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
