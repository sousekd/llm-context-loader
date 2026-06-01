/**
 * Builds the Fastify HTTP application and shared request boundary behavior.
 *
 * The HTTP host owns request ID generation, request-context entry, health route
 * registration, request-line logging, shared error responses, and registration
 * of configured adapter plugins.
 */

import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { ZodError } from "zod";

import { ClientError, InternalError } from "../../shared/errors.js";
import { enterRequestContext } from "../../shared/request-context.js";

import type { Logger } from "../../shared/logger.js";
import type { HttpAdapter } from "./adapter-contracts.js";

/** Builds the configured HTTP application from registered adapters. */
export async function buildHttpApp(
  httpAdapters: ReadonlyArray<HttpAdapter>,
  logger: Logger
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: true,
    genReqId: request => {
      const header = request.headers["x-request-id"];
      const candidate = Array.isArray(header) ? header[0] : header;
      return candidate?.trim() || randomUUID();
    }
  });

  app.addHook("onRequest", async request => {
    enterRequestContext({ request_id: String(request.id) });
  });

  app.addHook("onResponse", async (request, reply) => {
    if (request.url === "/health") return;
    logger.info(
      {
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        duration_ms: Math.round(reply.elapsedTime)
      },
      "HTTP request finished."
    );
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ClientError) {
      logger.warn(
        {
          method: request.method,
          url: request.url,
          status_code: error.statusCode,
          code: error.code
        },
        "HTTP client error."
      );
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      logger.warn(
        {
          method: request.method,
          url: request.url,
          status_code: 400,
          code: "invalid_request"
        },
        "HTTP validation error."
      );
      reply.code(400).send({ error: "invalid_request", details: error.flatten() });
      return;
    }
    const internal = toUnhandledRequestError(error);
    logger.error({ method: request.method, url: request.url, err: internal }, "Unhandled request error.");
    reply.code(500).send({ error: internal.code, message: "Internal server error" });
  });

  app.get("/health", async () => ({ status: "ok", service: "llm-context-loader" }));
  for (const adapter of httpAdapters) await adapter.register(app);
  return app;
}

/** Converts unclassified request failures into a stable internal error. */
function toUnhandledRequestError(error: unknown): InternalError {
  if (error instanceof InternalError) return error;
  return new InternalError("Unhandled request error", "unhandled_request_error", { cause: error });
}
