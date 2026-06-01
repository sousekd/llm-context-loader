/**
 * Exposes the verify-urls pipeline step descriptor to engine bundles.
 *
 * The runtime step is self-contained and receives only the configured artifact,
 * hallucination mode, reporting cap, and logger.
 */

import { parseVerifyUrlsStepConfig } from "./verify-urls-step-config.js";
import { VerifyUrlsStep } from "./verify-urls-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { VerifyUrlsStepConfig } from "./verify-urls-step-config.js";

/** Defines the built-in verify-urls step type. */
export const verifyUrlsStepDescriptor = {
  type: "verify-urls",
  parseConfig: parseVerifyUrlsStepConfig,
  create: args =>
    new VerifyUrlsStep(
      {
        artifact: args.config.artifact,
        onHallucination: args.config.onHallucination,
        maxReportedUrls: args.config.maxReportedUrls
      },
      { logger: args.deps.logger }
    )
} satisfies PipelineStepDescriptor<VerifyUrlsStepConfig>;
