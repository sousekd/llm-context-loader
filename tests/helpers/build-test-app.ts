import Fastify, { type FastifyPluginAsync, type FastifyPluginOptions } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../../src/core/util/errors.js";

// Shared Fastify harness for client route tests. Mirrors the error contract
// from `src/http.ts` (ZodError -> 400, AppError -> statusCode/code, else 500)
// without dragging in the production logger or composition wiring.
export async function buildTestApp<T extends FastifyPluginOptions>(plugin: FastifyPluginAsync<T>, opts: T) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "validation_error" });
      return;
    }
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code });
      return;
    }
    reply.code(500).send({ error: "internal_error" });
  });
  await app.register(plugin, opts);
  return app;
}
