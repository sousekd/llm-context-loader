/**
 * Implements URL-to-content loading through Node-native HTTP fetch.
 *
 * This provider fetches the input URL directly and returns the response body
 * as a content-typed `SourceDocument`. Text-like responses (determined by
 * `isTextLike` and the NUL-byte sniff) return the text arm; everything else
 * returns the binary arm.
 *
 * Text declared as HTML with embedded NUL bytes is treated as
 * `application/octet-stream` binary rather than decoded as text, preventing
 * lossy byte-to-character conversion from reaching downstream steps.
 *
 * - NO SSRF protection — the request goes wherever the input URL points.
 * - NO JavaScript rendering — returns server-returned source HTML only.
 *
 * Security: the host adapter's parseHttpUrl guards protocol (http/https only)
 * and absolute form, but does NOT filter private IPs or metadata endpoints.
 * This is accepted as a testing tool; do not deploy as a user-facing provider.
 *
 * Provider responses are untrusted external content. Upstream HTTP, empty-body,
 * and network failures are translated to `UpstreamError`. Oversized bodies are
 * capped at maxBytes during a streaming read and flagged as truncated.
 */

import { UpstreamError, isAbortError } from "../../../shared/errors.js";
import { isTextLike, mediaTypes } from "../../../shared/media-types.js";

import type { SourceDocument, SourceProvider } from "../../../contracts/extensions/source-provider.js";
import type { Logger } from "../../../shared/logger.js";
import type { HttpConfig } from "./http-provider-config.js";

/** Extracts the first <title> tag content from raw HTML. */
function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return undefined;
  const title = match[1].replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : undefined;
}

/** Carries the bytes read from a response body and whether the byte cap forced truncation. */
interface LimitedBody {
  readonly bytes: Uint8Array;
  readonly truncated: boolean;
}

/** Reads up to maxBytes from a fetch response body, cancelling the stream when the cap is reached. */
async function readLimitedBody(response: Response, maxBytes: number): Promise<LimitedBody> {
  if (!response.body) {
    const full = new Uint8Array(await response.arrayBuffer());
    if (full.byteLength > maxBytes) return { bytes: full.subarray(0, maxBytes), truncated: true };
    return { bytes: full, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const needed = maxBytes - totalBytes;
      if (needed <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }

      if (value.byteLength <= needed) {
        chunks.push(value);
        totalBytes += value.byteLength;
      } else {
        chunks.push(new Uint8Array(value.buffer, value.byteOffset, needed));
        totalBytes = maxBytes;
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    throw new UpstreamError("HTTP fetch response body read failed", "network", { cause: error });
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: output, truncated };
}

/** Implements the HTTP source provider using native fetch. */
export class HttpProvider implements SourceProvider {
  /** Creates an HTTP provider. */
  constructor(
    private readonly config: HttpConfig,
    private readonly deps: { readonly httpFetch: typeof globalThis.fetch; readonly logger: Logger }
  ) {}

  /** Loads a URL through native HTTP fetch and returns a typed source document. */
  async load(url: string, opts: { readonly signal: AbortSignal }): Promise<SourceDocument> {
    try {
      const response = await this.deps.httpFetch(url, {
        signal: opts.signal,
        redirect: "follow",
        headers: { "user-agent": this.config.userAgent }
      });

      if (!response.ok) {
        throw new UpstreamError(`HTTP fetch returned HTTP ${response.status}`, `http_${response.status}`, {
          upstreamStatus: response.status || 502,
          cause: undefined
        });
      }

      const reported = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const mediaType = reported || mediaTypes.plainText;

      const limited = await readLimitedBody(response, this.config.maxBytes);

      if (isTextLike(mediaType) && !limited.bytes.includes(0)) {
        const html = new TextDecoder().decode(limited.bytes);
        const content = html.trim();

        if (!content) {
          throw new UpstreamError("HTTP fetch returned empty body", "empty", {
            upstreamStatus: response.status
          });
        }

        const title = this.config.titleFromHtml ? extractTitle(html) : undefined;
        return { kind: "text", content, mediaType, title, truncated: limited.truncated };
      }

      const binaryMediaType = limited.bytes.includes(0) && isTextLike(mediaType) ? mediaTypes.octetStream : mediaType;
      return { kind: "binary", bytes: limited.bytes, mediaType: binaryMediaType, truncated: limited.truncated };
    } catch (error) {
      if (error instanceof UpstreamError || isAbortError(error)) throw error;
      throw new UpstreamError(error instanceof Error ? error.message : String(error), "network", { cause: error });
    }
  }
}
