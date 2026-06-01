/**
 * Implements Open WebUI's external web loader HTTP contract.
 *
 * The adapter accepts a batch of URLs, validates each URL independently, runs
 * the configured pipeline once per valid URL, and returns Open WebUI document
 * rows. Per-URL validation failures render through the pipeline renderer so a
 * bad URL does not fail the whole batch.
 */

import { z } from "zod";

import { ClientError } from "../../../../shared/errors.js";
import { parseHttpUrl } from "../../../../shared/urls.js";
import { enforceBearerAuth } from "../auth.js";

import type { PipelineHandle } from "../../../../contracts/pipeline/handle.js";
import type { Logger } from "../../../../shared/logger.js";
import type { AnyFastifyInstance, HttpAdapter } from "../../adapter-contracts.js";
import type { BearerAuthConfig } from "../auth.js";
import type { OpenWebUiConfig } from "./open-webui-adapter-config.js";

const requestSchema = z.object({ urls: z.array(z.string()).min(1) }).strict();

/** Represents one document row returned to Open WebUI. */
interface OpenWebUiDocument {
  readonly page_content: string;
  readonly metadata: { readonly source: string; readonly title?: string };
}

/** Per-URL load outcome carrying the response document and pipeline result. */
interface UrlOutcome {
  readonly document: OpenWebUiDocument;
  readonly result: "ok" | "degraded" | "failed";
}

/** Registers the Open WebUI external web loader HTTP route. */
export class OpenWebUiAdapter implements HttpAdapter {
  /** Creates an Open WebUI adapter. */
  constructor(
    private readonly config: OpenWebUiConfig,
    private readonly deps: {
      readonly pipeline: PipelineHandle;
      readonly logger: Logger;
    }
  ) {}

  /** Registers the Open WebUI route. */
  async register(server: AnyFastifyInstance): Promise<void> {
    server.post(this.config.path, async request => {
      enforceBearerAuth(this.authConfig(), request);
      const body = requestSchema.parse(request.body);
      if (body.urls.length > this.config.maxUrls) throw new ClientError("Too many URLs", "too_many_urls", 400);
      const startedAt = Date.now();
      const outcomes = await Promise.all(body.urls.map(url => this.loadOne(url)));
      this.deps.logger.debug(
        {
          url_count: body.urls.length,
          duration_ms: Date.now() - startedAt,
          ok_count: outcomes.filter(outcome => outcome.result === "ok").length,
          degraded_count: outcomes.filter(outcome => outcome.result === "degraded").length,
          failed_count: outcomes.filter(outcome => outcome.result === "failed").length
        },
        "Open WebUI batch finished."
      );
      return outcomes.map(outcome => outcome.document);
    });
  }

  /** Loads one URL into an Open WebUI document, isolating per-URL failures. */
  private async loadOne(url: string): Promise<UrlOutcome> {
    let parsedUrl: string;
    try {
      parsedUrl = parseHttpUrl(url);
    } catch (error) {
      if (!(error instanceof ClientError)) throw error;
      this.deps.logger.warn({ url, err: error }, "Open WebUI URL failed.");
      const rendered = await this.deps.pipeline.renderFailure({ url }, error);
      return { document: { page_content: rendered, metadata: { source: url } }, result: "failed" };
    }

    const output = await this.deps.pipeline.run({ url: parsedUrl });
    const title = output.run.body?.title;
    return {
      document: { page_content: output.markdown, metadata: title ? { source: url, title } : { source: url } },
      result: output.run.report.result
    };
  }

  /** Converts configured bearer auth into the shared auth helper shape. */
  private authConfig(): BearerAuthConfig | undefined {
    return this.config.auth.bearerToken ? { token: this.config.auth.bearerToken } : undefined;
  }
}
