import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { AppConfig } from "../../config/config.js";
import type { LoadContextUseCase } from "../../core/use-cases/load-context.js";
import { enforceBearerAuth } from "../auth.js";
import { toOpenWebUiDocuments } from "./adapter.js";

// OpenWebUI external loader HTTP route adapter for batched URL loading.
// Enforces request shape and delegates URL processing to the shared use-case.
const OPEN_WEBUI_BATCH_SIZE = 20;

const OpenWebUiRequestSchema = z.object({
  urls: z.array(z.string()).min(1).max(OPEN_WEBUI_BATCH_SIZE)
});

export interface OpenWebUiPluginOptions {
  config: AppConfig;
  useCase: LoadContextUseCase;
}

/** Register OpenWebUI-compatible POST / route. */
export const openWebUiPlugin: FastifyPluginAsync<OpenWebUiPluginOptions> = async (app, opts) => {
  app.post("/", async (request) => {
    enforceBearerAuth(opts.config, request);
    const body = OpenWebUiRequestSchema.parse(request.body);
    const documents = await opts.useCase.loadMany(body.urls);
    return toOpenWebUiDocuments(documents);
  });
};
