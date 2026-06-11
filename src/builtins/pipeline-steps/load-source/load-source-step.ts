/**
 * Loads the initial body for a configured pipeline run.
 *
 * Provider-specific upstream failures are classified here, not in core. The
 * step emits the first body version (text or binary, carrying the provider's
 * media type) and optional title diagnostics, or skips if an earlier step
 * already produced a body.
 */

import { UpstreamError, isAbortError } from "../../../shared/errors.js";

import type { SourceProvider } from "../../../contracts/extensions/source-provider.js";
import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";

/** Fetches source content and writes the initial pipeline body. */
export class LoadSourceStep implements PipelineStep {
  /** Creates a load-source step instance. */
  constructor(private readonly deps: { readonly sourceProvider: SourceProvider; readonly logger: Logger }) {}

  /** Loads content for the requested URL unless a body already exists. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    if (ctx.body.current()) return { status: "skipped", reason: "body_present" };

    try {
      const document = await this.deps.sourceProvider.load(ctx.input.url, { signal: ctx.signal });

      if (document.kind === "text") {
        const content = document.content.trim();
        if (!content) return { status: "failed", reason: "empty" };

        return {
          status: document.truncated ? "degraded" : "ok",
          reason: document.truncated ? "truncated" : undefined,
          diagnostics: document.title ? { attributes: { title: document.title } } : undefined,
          effects: { body: { kind: "text", content, mediaType: document.mediaType, title: document.title } }
        };
      }

      if (document.bytes.byteLength === 0) return { status: "failed", reason: "empty" };

      return {
        status: document.truncated ? "degraded" : "ok",
        reason: document.truncated ? "truncated" : undefined,
        effects: {
          body: { kind: "binary", bytes: document.bytes, mediaType: document.mediaType, title: document.title }
        }
      };
    } catch (error) {
      return classifySourceLoadFailure(error);
    }
  }
}

/** Converts provider failures into load-source step reason tokens, or rethrows bugs. */
function classifySourceLoadFailure(error: unknown): StepResult {
  if (isAbortError(error)) return { status: "failed", reason: "timeout" };
  if (!(error instanceof UpstreamError)) throw error;

  const status = error.upstreamStatus ?? 0;
  const fallbackReason = status >= 400 && status < 500 ? "upstream_4xx" : status >= 500 ? "upstream_5xx" : "network";
  return { status: "failed", reason: error.upstreamCode || fallbackReason };
}
