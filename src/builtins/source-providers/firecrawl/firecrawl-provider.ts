/**
 * Implements URL-to-markdown loading through Firecrawl's v2 scrape endpoint.
 *
 * Provider responses are untrusted external content. Upstream HTTP, JSON parse,
 * response-shape, empty-body, and network failures are translated to
 * `UpstreamError`; its constructor owns the sanitizeUpstreamCode security
 * boundary before failures reach step diagnostics or logs.
 */

import { z } from "zod";

import { UpstreamError, isAbortError } from "../../../shared/errors.js";
import { joinUrl } from "../../../shared/urls.js";

import type { SourceDocument, SourceProvider } from "../../../contracts/extensions/source-provider.js";
import type { Logger } from "../../../shared/logger.js";
import type { FirecrawlConfig } from "./firecrawl-provider-config.js";

const firecrawlResponseSchema = z
  .object({
    success: z.boolean().optional(),
    code: z.unknown().optional(),
    error: z.string().optional(),
    data: z
      .object({
        markdown: z.string().optional(),
        title: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      })
      .optional(),
    markdown: z.string().optional(),
    title: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .passthrough();

/** Implements the Firecrawl source provider using the v2 scrape endpoint. */
export class FirecrawlProvider implements SourceProvider {
  /** Creates a Firecrawl provider. */
  constructor(
    private readonly config: FirecrawlConfig,
    private readonly deps: { readonly httpFetch: typeof globalThis.fetch; readonly logger: Logger }
  ) {}

  /** Loads a URL through Firecrawl and returns markdown content. */
  async load(url: string, opts: { readonly signal: AbortSignal }): Promise<SourceDocument> {
    try {
      const response = await this.deps.httpFetch(joinUrl(this.config.baseUrl, "/v2/scrape"), {
        method: "POST",
        signal: opts.signal,
        headers: this.headers(),
        body: JSON.stringify({
          url,
          formats: this.config.formats,
          onlyMainContent: this.config.onlyMainContent,
          maxAge: this.config.maxAge
        })
      });

      const raw: unknown = await response.json().catch((error: unknown) => {
        if (isAbortError(error)) throw error;
        throw new UpstreamError("Firecrawl response was not valid JSON", "parse_error", {
          upstreamStatus: response.status,
          cause: error
        });
      });
      const parsed = firecrawlResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new UpstreamError("Firecrawl response shape was not recognized", "parse_error", {
          upstreamStatus: response.status,
          cause: parsed.error.flatten()
        });
      if (!response.ok || parsed.data.success === false) {
        throw new UpstreamError(
          parsed.data.error ?? `Firecrawl returned HTTP ${response.status}`,
          parsed.data.code ?? `http_${response.status}`,
          { upstreamStatus: response.status || 502, cause: raw }
        );
      }

      const data = parsed.data.data ?? parsed.data;
      const metadata = data.metadata ?? {};
      const content = data.markdown?.trim() ?? "";
      if (!content)
        throw new UpstreamError("Firecrawl returned empty markdown", "empty", { upstreamStatus: response.status });
      const title = data.title ?? (typeof metadata.title === "string" ? metadata.title : undefined);
      return { content, title };
    } catch (error) {
      if (error instanceof UpstreamError || isAbortError(error)) throw error;
      throw new UpstreamError(error instanceof Error ? error.message : String(error), "network", { cause: error });
    }
  }

  /** Builds request headers for the upstream Firecrawl endpoint. */
  private headers(): HeadersInit {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }
}
