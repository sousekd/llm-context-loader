import type { AppConfig } from "../../../config/config.js";
import type { FetchProvider } from "../../../core/ports/fetch-provider.js";
import type { FetchedDocument } from "../../../core/types.js";
import type { FirecrawlConfig } from "./firecrawl-env.js";
import type { FirecrawlResponse } from "./firecrawl-types.js";

import { AppError } from "../../../core/util/errors.js";
import { joinUrl } from "../../../core/util/urls.js";

// Firecrawl /v2/scrape provider implementation for the fetch port.
// Handles untrusted external content at the response parsing security boundary.

/** Slugify upstream error codes before interpolating them in AppError codes. */
function sanitizeUpstreamCode(value: unknown): string {
  if (value === undefined || value === null) return "firecrawl_error";
  const slug = String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "firecrawl_error";
}

export type FetchFn = typeof fetch;

export interface FirecrawlFetchProviderOptions {
  fetchFn?: FetchFn;
}

export class FirecrawlFetchProvider implements FetchProvider {
  readonly name = "firecrawl";
  private readonly fetchFn: FetchFn;

  /** Create a Firecrawl-backed fetch provider for normalized URL fetches. */
  constructor(
    private readonly config: AppConfig,
    private readonly firecrawlConfig: FirecrawlConfig,
    options: FirecrawlFetchProviderOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /** Fetch one URL via Firecrawl and normalize the markdown payload. */
  async fetch(url: string): Promise<FetchedDocument> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.FETCH_TIMEOUT_SECONDS * 1000);

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (this.firecrawlConfig.FIRECRAWL_API_KEY) {
        headers.authorization = `Bearer ${this.firecrawlConfig.FIRECRAWL_API_KEY}`;
      }

      const response = await this.fetchFn(joinUrl(this.firecrawlConfig.FIRECRAWL_BASE_URL, "/v2/scrape"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: this.firecrawlConfig.FIRECRAWL_ONLY_MAIN_CONTENT
        }),
        signal: controller.signal
      });

      const text = await response.text();
      let payload: FirecrawlResponse;
      try {
        payload = JSON.parse(text) as FirecrawlResponse;
      } catch {
        throw new AppError(`Firecrawl returned non-JSON response: ${text.slice(0, 300)}`, "firecrawl_non_json", 502);
      }

      if (!response.ok || payload.success === false) {
        throw new AppError(
          payload.error || `Firecrawl request failed with HTTP ${response.status}`,
          sanitizeUpstreamCode(payload.code),
          502,
          payload
        );
      }

      const markdown = payload.data?.markdown;
      if (typeof markdown !== "string") {
        throw new AppError("Firecrawl response did not contain data.markdown", "firecrawl_missing_markdown", 502, payload);
      }

      const metadata = payload.data?.metadata || {};
      const title = typeof metadata.title === "string" ? metadata.title : undefined;
      const statusCode = typeof metadata.statusCode === "number" ? metadata.statusCode : undefined;
      const contentType = typeof metadata.contentType === "string" ? metadata.contentType : undefined;

      return {
        url,
        title,
        markdown,
        statusCode,
        contentType,
        providerMetadata: metadata
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Firecrawl request timed out", "firecrawl_timeout", 504);
      }
      throw new AppError(error instanceof Error ? error.message : String(error), "firecrawl_request_failed", 502, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
