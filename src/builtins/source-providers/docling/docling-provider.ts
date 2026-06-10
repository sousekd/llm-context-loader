/**
 * Implements typed text loading through Docling Serve's sync convert endpoint.
 *
 * Provider responses are untrusted external content. Upstream HTTP, JSON parse,
 * response-shape, empty-body, and network failures are translated to
 * `UpstreamError`; its constructor owns the sanitizeUpstreamCode security
 * boundary before failures reach step diagnostics or logs.
 */

import { z } from "zod";

import { UpstreamError, isAbortError } from "../../../shared/errors.js";
import { mediaTypes } from "../../../shared/media-types.js";
import { joinUrl } from "../../../shared/urls.js";

import type { SourceDocument, SourceProvider } from "../../../contracts/extensions/source-provider.js";
import type { Logger } from "../../../shared/logger.js";
import type { DoclingConfig } from "./docling-provider-config.js";

const acceptedStatuses = new Set(["success", "partial_success"]);

const doclingResponseSchema = z
  .object({
    document: z
      .object({
        md_content: z.string().nullable().optional(),
        html_content: z.string().nullable().optional(),
        json_content: z
          .object({
            name: z.string().optional()
          })
          .passthrough()
          .nullable()
          .optional()
      })
      .passthrough()
      .optional(),
    status: z.string().optional(),
    errors: z
      .array(
        z
          .object({
            error_message: z.string().optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

/** Implements the Docling source provider using the sync convert endpoint. */
export class DoclingProvider implements SourceProvider {
  /** Creates a Docling provider. */
  constructor(
    private readonly config: DoclingConfig,
    private readonly deps: { readonly httpFetch: typeof globalThis.fetch; readonly logger: Logger }
  ) {}

  /** Loads a URL through Docling and returns configured text content. */
  async load(url: string, opts: { readonly signal: AbortSignal }): Promise<SourceDocument> {
    try {
      const response = await this.deps.httpFetch(joinUrl(this.config.baseUrl, "/v1/convert/source"), {
        method: "POST",
        signal: opts.signal,
        headers: this.headers(),
        body: JSON.stringify(this.buildRequestBody(url))
      });

      const raw: unknown = await response.json().catch((error: unknown) => {
        if (isAbortError(error)) throw error;
        throw new UpstreamError("Docling response was not valid JSON", "parse_error", {
          upstreamStatus: response.status,
          cause: error
        });
      });
      const parsed = doclingResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new UpstreamError("Docling response shape was not recognized", "parse_error", {
          upstreamStatus: response.status,
          cause: parsed.error.flatten()
        });

      const data = parsed.data;
      const status = data.status ?? (response.ok ? "success" : "failure");

      if (!response.ok || !acceptedStatuses.has(status)) {
        const errors = data.errors?.map(e => e.error_message).filter(Boolean) ?? [];
        const message = errors.length > 0 ? errors.join("; ") : `Docling returned HTTP ${response.status}`;
        throw new UpstreamError(message, status === "failure" ? status : `http_${response.status}`, {
          upstreamStatus: response.status || 502,
          cause: raw
        });
      }

      const doc = data.document;
      const rawContent = this.config.output === "html" ? doc?.html_content : doc?.md_content;
      const content = rawContent?.trim() ?? "";
      if (!content)
        throw new UpstreamError(`Docling returned empty ${this.config.output}`, "empty", {
          upstreamStatus: response.status
        });

      const name = data.document?.json_content?.name;
      const title = typeof name === "string" && name.length > 0 ? name : undefined;
      const mediaType: string = this.config.output === "html" ? mediaTypes.html : mediaTypes.markdown;

      return { kind: "text", content, mediaType, title };
    } catch (error) {
      if (error instanceof UpstreamError || isAbortError(error)) throw error;
      throw new UpstreamError(error instanceof Error ? error.message : String(error), "network", { cause: error });
    }
  }

  /** Builds the request body for the Docling sync convert endpoint. */
  private buildRequestBody(url: string): unknown {
    return {
      sources: [{ kind: "http", url }],
      options: {
        to_formats: this.config.output === "html" ? ["html", "json"] : ["md", "json"],
        image_export_mode: "placeholder",
        do_ocr: this.config.doOcr,
        table_mode: this.config.tableMode
      }
    };
  }

  /** Builds request headers for the upstream Docling endpoint. */
  private headers(): HeadersInit {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers["x-api-key"] = this.config.apiKey;
    return headers;
  }
}
