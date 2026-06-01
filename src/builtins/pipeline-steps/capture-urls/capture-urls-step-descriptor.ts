/**
 * Exposes the capture-urls pipeline step descriptor to engine bundles.
 *
 * The runtime step is self-contained and only depends on markdown URL helpers
 * plus the configured artifact name.
 */

import { parseCaptureUrlsStepConfig } from "./capture-urls-step-config.js";
import { CaptureUrlsStep } from "./capture-urls-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { CaptureUrlsStepConfig } from "./capture-urls-step-config.js";

/** Defines the built-in capture-urls step type. */
export const captureUrlsStepDescriptor = {
  type: "capture-urls",
  parseConfig: parseCaptureUrlsStepConfig,
  create: args => new CaptureUrlsStep(args.config, { logger: args.deps.logger })
} satisfies PipelineStepDescriptor<CaptureUrlsStepConfig>;
