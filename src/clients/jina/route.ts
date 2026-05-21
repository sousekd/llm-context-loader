import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import type { AppConfig } from "../../config/config.js";
import type { LoadContextUseCase } from "../../core/use-cases/load-context.js";
import { AppError } from "../../core/util/errors.js";
import { enforceBearerAuth } from "../auth.js";

// Jina Reader compatibility route for URL-to-markdown responses.
// Supports /r/<url> and /r?url=... while omitting optional Jina extensions.

const JinaQuerySchema = z.object({
  url: z.string().min(1)
});

export interface JinaPluginOptions {
  config: AppConfig;
  useCase: LoadContextUseCase;
}

/** Register Jina-compatible URL reader routes under /r. */
export const jinaPlugin: FastifyPluginAsync<JinaPluginOptions> = async (app, opts) => {
  app.get("/r", async (request, reply) => {
    enforceBearerAuth(opts.config, request);
    const query = JinaQuerySchema.parse(request.query);
    return await serveMarkdown(opts.useCase, query.url, reply);
  });

  app.get("/r/*", async (request, reply) => {
    enforceBearerAuth(opts.config, request);
    const url = extractRawUrl(request.raw.url ?? "");
    if (!url) {
      throw new AppError("Missing URL after /r/", "bad_request", 400);
    }
    return await serveMarkdown(opts.useCase, url, reply);
  });
};

/** Extract the raw URL segment after /r/ from an incoming request path. */
function extractRawUrl(rawUrl: string): string {
  const prefix = "/r/";
  const idx = rawUrl.indexOf(prefix);
  if (idx === -1) return "";
  return rawUrl.slice(idx + prefix.length);
}

/** Load one URL through the use-case and return markdown response text. */
async function serveMarkdown(
  useCase: LoadContextUseCase,
  url: string,
  reply: FastifyReply
): Promise<string> {
  const document = await useCase.loadOne(url);
  reply.type("text/markdown; charset=utf-8");
  return document.pageContent;
}
