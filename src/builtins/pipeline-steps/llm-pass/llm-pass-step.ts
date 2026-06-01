/**
 * Runs prompt-rendered LLM transformations against the current markdown body.
 *
 * The step owns provider failure classification for LLM calls, template-render
 * failure handling, input length gates, and character-based context-fit checks.
 * It preserves the current body title when the LLM returns replacement content.
 */

import { UpstreamError, isAbortError } from "../../../shared/errors.js";

import type { LlmProvider } from "../../../contracts/extensions/llm-provider.js";
import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { TemplateRenderer } from "../../../shared/template-renderer.js";
import type { LlmPassStepOptions } from "./llm-pass-step-config.js";

/** Runs a prompt-rendered LLM transformation against the current body. */
export class LlmPassStep implements PipelineStep {
  /** Creates an LLM pass step instance. */
  constructor(
    private readonly config: LlmPassStepOptions,
    private readonly deps: { readonly templates: TemplateRenderer; readonly llm: LlmProvider; readonly logger: Logger }
  ) {}

  /** Runs an LLM transformation against the current body when eligible. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    if (!body) return { status: "skipped", reason: "no_body" };
    if (this.config.minInputChars !== undefined && body.content.length < this.config.minInputChars)
      return { status: "skipped", reason: "too_short" };
    if (this.config.maxInputChars !== undefined && body.content.length > this.config.maxInputChars)
      return { status: "skipped", reason: "too_long" };

    let system: string;
    let user: string;
    try {
      const variables = {
        ...this.config.templates.vars,
        url: ctx.input.url,
        title: body.title,
        content: body.content
      };
      system = this.deps.templates.render(this.config.templates.system, variables);
      user = this.deps.templates.render(this.config.templates.user, variables);
    } catch {
      return { status: "failed", reason: "template_error" };
    }

    const reserveChars = this.computeReserveChars(body.content.length);
    if (!this.deps.llm.canFit(`${system}\n${user}`, reserveChars))
      return { status: "skipped", reason: "context_overflow" };

    try {
      const result = await this.deps.llm.chat(
        [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        { signal: ctx.signal }
      );
      const text = result.text.trim();
      if (!text) return { status: "failed", reason: "empty_response" };
      return { status: "ok", effects: { body: { content: text, title: body.title } } };
    } catch (error) {
      return classifyLlmPassFailure(error);
    }
  }

  /** Computes the output character reservation used for the context-fit check. */
  private computeReserveChars(inputChars: number): number {
    const ratioReserve =
      this.config.outputReserveRatio !== undefined ? Math.ceil(inputChars * this.config.outputReserveRatio) : undefined;
    const absoluteReserve = this.config.outputReserveChars;
    if (ratioReserve === undefined && absoluteReserve === undefined) return inputChars;
    return Math.max(ratioReserve ?? 0, absoluteReserve ?? 0);
  }
}

/** Converts provider failures into LLM pass step reason tokens, or rethrows bugs. */
function classifyLlmPassFailure(error: unknown): StepResult {
  if (isAbortError(error)) return { status: "failed", reason: "timeout" };
  if (!(error instanceof UpstreamError)) throw error;

  const status = error.upstreamStatus ?? 0;
  const fallbackReason = status >= 400 && status < 500 ? "upstream_4xx" : status >= 500 ? "upstream_5xx" : "network";
  return { status: "failed", reason: error.upstreamCode || fallbackReason };
}
