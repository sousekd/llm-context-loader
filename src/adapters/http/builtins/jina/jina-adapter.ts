/**
 * Implements a limited Jina Reader-style URL-to-markdown HTTP contract.
 *
 * The adapter accepts either `GET /r/<url>` or `GET /r?url=<url>`, validates the
 * target URL at the shared URL security boundary, runs one configured pipeline,
 * and returns rendered markdown.
 */

import { ClientError } from "../../../../shared/errors.js";
import { parseHttpUrl } from "../../../../shared/urls.js";
import { enforceBearerAuth } from "../auth.js";

import type { FastifyReply, FastifyRequest } from "fastify";

import type { PipelineHandle } from "../../../../contracts/pipeline/handle.js";
import type { Logger } from "../../../../shared/logger.js";
import type { AnyFastifyInstance, HttpAdapter } from "../../adapter-contracts.js";
import type { BearerAuthConfig } from "../auth.js";
import type { JinaConfig } from "./jina-adapter-config.js";

/** Registers the Jina Reader-style URL-to-markdown HTTP routes. */
export class JinaAdapter implements HttpAdapter {
  /** Creates a Jina Reader-style adapter. */
  constructor(
    private readonly config: JinaConfig,
    private readonly deps: {
      readonly pipeline: PipelineHandle;
      readonly logger: Logger;
    }
  ) {}

  /** Registers Jina-style path and query routes. */
  async register(server: AnyFastifyInstance): Promise<void> {
    server.get(`${this.config.path}`, async (request, reply) => this.handle(request, reply));
    server.get(`${this.config.path}/*`, async (request, reply) => this.handle(request, reply));
  }

  /** Handles one Jina-style request and renders markdown output. */
  private async handle(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    enforceBearerAuth(this.authConfig(), request);
    const rawUrl = this.extractUrl(request);
    const output = await this.deps.pipeline.run({ url: parseHttpUrl(rawUrl) });
    reply.type("text/markdown; charset=utf-8");
    return output.markdown;
  }

  /** Extracts the target URL from the path wildcard or query string. */
  private extractUrl(request: FastifyRequest): string {
    const queryUrl = (request.query as { url?: string }).url;
    if (queryUrl) return queryUrl;
    const wildcard = (request.params as { "*"?: string })["*"];
    if (!wildcard) throw new ClientError("Missing URL", "missing_url", 400);
    const prefix = `${this.config.path}/`;
    const raw = request.url ?? "";
    const tail = raw.startsWith(prefix) ? raw.slice(prefix.length) : wildcard;
    return decodeURIComponent(tail);
  }

  /** Converts configured bearer auth into the shared auth helper shape. */
  private authConfig(): BearerAuthConfig | undefined {
    return this.config.auth.bearerToken ? { token: this.config.auth.bearerToken } : undefined;
  }
}
