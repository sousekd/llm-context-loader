/**
 * Captures canonical URLs from the current body into a pipeline artifact.
 *
 * The captured artifact is the trusted inventory used by verify-urls quality
 * gates after LLM transformations. Diagnostics expose only the artifact name and
 * URL count; later steps read the actual Set through the artifact bag.
 */

import { collectCanonicalUrls } from "../../../shared/markdown-urls.js";

import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { CaptureUrlsStepOptions } from "./capture-urls-step-config.js";

/** Captures a canonical URL inventory from the current body into an artifact. */
export class CaptureUrlsStep implements PipelineStep {
  /** Creates a capture-urls step instance. */
  constructor(
    private readonly config: CaptureUrlsStepOptions,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Reads the current body, canonicalizes its URLs, and writes the inventory artifact. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    if (!body) return { status: "skipped", reason: "no_body" };

    const urls = collectCanonicalUrls(body.content);
    return {
      status: "ok",
      effects: { artifacts: { [this.config.artifact]: urls } },
      diagnostics: { attributes: { artifact: this.config.artifact, url_count: urls.size } }
    };
  }
}
