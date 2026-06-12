/**
 * Implements typed text loading through Firecrawl's v2 scrape endpoint.
 *
 * Provider responses are untrusted external content. Upstream HTTP, JSON parse,
 * response-shape, empty-body, and network failures are translated to
 * `UpstreamError`; its constructor owns the sanitizeUpstreamCode security
 * boundary before failures reach step diagnostics or logs.
 */

import { z } from "zod";

import { UpstreamError, isAbortError } from "../../../shared/errors.js";
import { looksLikeHtml, mediaTypes } from "../../../shared/media-types.js";
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
        html: z.string().optional(),
        rawHtml: z.string().optional(),
        title: z.string().optional(),
        metadata: z.record(z.unknown()).optional()
      })
      .optional(),
    markdown: z.string().optional(),
    html: z.string().optional(),
    rawHtml: z.string().optional(),
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

  /** Loads a URL through Firecrawl and returns configured text content. */
  async load(url: string, opts: { readonly signal: AbortSignal }): Promise<SourceDocument> {
    try {
      const response = await this.deps.httpFetch(joinUrl(this.config.baseUrl, "/v2/scrape"), {
        method: "POST",
        signal: opts.signal,
        headers: this.headers(),
        body: JSON.stringify({
          url,
          formats: [this.config.output],
          onlyMainContent: this.config.onlyMainContent,
          removeBase64Images: this.config.stripBase64Images,
          parsers: this.config.parsePdf ? ["pdf"] : []
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
      const contentField = data[this.config.output] as string | undefined;
      const content = contentField?.trim() ?? "";
      if (!content)
        throw new UpstreamError(`Firecrawl returned empty ${this.config.output}`, "empty", {
          upstreamStatus: response.status
        });
      const title = data.title ?? (typeof metadata.title === "string" ? metadata.title : undefined);
      const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "";

      if (!this.config.parsePdf) {
        const essence = contentType.split(";", 1)[0].trim().toLowerCase();
        if (essence === mediaTypes.pdf) {
          const raw = extractBase64Payload(content, this.config.output);
          if (!raw) {
            throw new UpstreamError("Firecrawl returned empty base64 PDF payload", "empty", {
              upstreamStatus: response.status
            });
          }
          const bytes = Buffer.from(raw, "base64");
          if (bytes.byteLength === 0) {
            throw new UpstreamError("Firecrawl returned empty PDF bytes after base64 decode", "empty", {
              upstreamStatus: response.status
            });
          }
          return { kind: "binary", bytes, mediaType: mediaTypes.pdf, title };
        }
      }

      const mediaType = deriveTextMediaType(this.config.output, content);
      return { kind: "text", content, mediaType, title };
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

/**
 * Derives a truthful media type for the text returned by Firecrawl.
 *
 * - markdown output is always `text/markdown`.
 * - html output is always `text/html` (Firecrawl wraps non-HTML content).
 * - rawHtml is "raw": real HTML for web pages/sites, bare text for PDFs.
 */
function deriveTextMediaType(output: string, content: string): string {
  if (output === "markdown") return mediaTypes.markdown;
  if (output === "html") return mediaTypes.html;
  return looksLikeHtml(content) ? mediaTypes.html : mediaTypes.plainText;
}

/**
 * Extracts the base64-encoded payload from a Firecrawl response field.
 *
 * With parsers:[], Firecrawl returns base64 of the raw file bytes. When
 * output=html, the base64 is wrapped in `<html><body>…</body></html>`;
 * for markdown and rawHtml it is bare.
 */
function extractBase64Payload(content: string, output: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  if (output !== "html") return trimmed;
  return trimmed.replace(/^<html>(<body>)?/i, "").replace(/(<\/body>)?<\/html>$/i, "");
}
