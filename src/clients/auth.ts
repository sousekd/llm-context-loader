import { timingSafeEqual } from "node:crypto";

import type { FastifyRequest } from "fastify";

import type { AppConfig } from "../config/config.js";
import { AppError } from "../core/util/errors.js";

// Bearer-token enforcement shared by all authenticated HTTP client routes.
// Comparison is constant-time at the security boundary to reduce timing leakage.
/** Validate Authorization bearer token according to configured auth policy. */
export function enforceBearerAuth(config: AppConfig, request: FastifyRequest): void {
  if (!config.AUTH_ENABLED) return;

  const expected = Buffer.from(`Bearer ${config.API_KEY}`);
  const actual = Buffer.from(request.headers.authorization || "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError("Authentication required", "unauthorized", 401);
  }
}
