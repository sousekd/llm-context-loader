import Fastify from "fastify";
import { ZodError } from "zod";

import type { Composition } from "./composition.js";
import type { Logger } from "./core/util/logger.js";
import { AppError } from "./core/util/errors.js";

// Fastify app assembly and shared HTTP error handling policy.
// Registers selected client plugins and serves the liveness probe.
/** Build and configure the Fastify HTTP application. */
export async function buildHttpApp(composition: Composition, logger: Logger) {
  const app = Fastify({ loggerInstance: logger });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "validation_error", details: error.flatten() });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }

    logger.error({ event: "http.unhandled_error", method: request.method, url: request.url, err: error }, "Unhandled request error");
    const message = error instanceof Error ? error.message : String(error);
    reply.code(500).send({ error: "internal_error", message });
  });

  app.get("/health", async () => ({ status: "ok", service: "llm-context-loader" }));

  for (const client of composition.clients) {
    if (client.kind !== "http") continue;
    const { plugin, options } = client.build({ config: composition.config, useCase: composition.useCase });
    await app.register(plugin, options);
  }

  return app;
}
