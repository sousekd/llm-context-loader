/**
 * Classifies the input URL against configured rules and emits matching signals.
 *
 * Runs at most once per pipeline. Every matching rule emits one boolean signal
 * (true). Multiple rules may share the same signal name (natural OR).
 */

import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { ClassifyUrlStepOptions } from "./classify-url-step-config.js";

/** Classifies the pipeline input URL and emits matching signals. */
export class ClassifyUrlStep implements PipelineStep {
  /** Creates a classify-url step instance. */
  constructor(
    private readonly config: ClassifyUrlStepOptions,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Evaluates all rules against the input URL and returns matching signals. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const matched: Record<string, true> = {};

    for (const rule of this.config.rules) {
      if (rule.match(ctx.input.url)) matched[rule.signal] = true;
    }

    const keys = Object.keys(matched);
    return {
      status: "ok",
      effects: keys.length > 0 ? { signals: Object.fromEntries(keys.map(k => [k, true])) } : undefined,
      diagnostics: { attributes: { matched: keys.length > 0 ? keys.join(" ") : "none" } }
    };
  }
}
