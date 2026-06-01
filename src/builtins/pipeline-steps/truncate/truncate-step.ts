/**
 * Applies the final markdown body size budget for a pipeline run.
 *
 * The step preserves the current title and writes a new body version only when
 * content exceeds the configured target. The truncation suffix is counted inside
 * the target budget.
 */

import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { TruncateStepOptions } from "./truncate-step-config.js";

const TRUNCATION_SUFFIX = "... [TRUNCATED]";

/** Truncates the final body to a configured character budget. */
export class TruncateStep implements PipelineStep {
  /** Creates a truncate step instance. */
  constructor(
    private readonly config: TruncateStepOptions,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Truncates the current body when it exceeds the configured target. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    if (!body) return { status: "skipped", reason: "no_body" };
    const inputChars = body.content.length;
    if (this.config.targetChars === 0 || inputChars <= this.config.targetChars)
      return { status: "skipped", reason: "under_target" };

    const truncated = truncateToBudget(body.content, this.config.targetChars);
    return {
      status: "ok",
      effects: { body: { content: truncated, title: body.title } }
    };
  }
}

/** Cuts content so the truncation suffix fits inside the target budget. */
function truncateToBudget(content: string, targetChars: number): string {
  if (targetChars <= TRUNCATION_SUFFIX.length) return TRUNCATION_SUFFIX.slice(0, targetChars);
  const prefix = content.slice(0, targetChars - TRUNCATION_SUFFIX.length).trimEnd();
  return `${prefix}${TRUNCATION_SUFFIX}`;
}
