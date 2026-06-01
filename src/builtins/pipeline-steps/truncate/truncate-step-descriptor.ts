/**
 * Exposes the truncate pipeline step descriptor to engine bundles.
 *
 * Truncate is a self-contained final body size gate and has no provider or host
 * tool dependencies.
 */

import { parseTruncateStepConfig } from "./truncate-step-config.js";
import { TruncateStep } from "./truncate-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { TruncateStepConfig } from "./truncate-step-config.js";

/** Defines the built-in truncate step type. */
export const truncateStepDescriptor = {
  type: "truncate",
  parseConfig: parseTruncateStepConfig,
  create: args => new TruncateStep(args.config, { logger: args.deps.logger })
} satisfies PipelineStepDescriptor<TruncateStepConfig>;
