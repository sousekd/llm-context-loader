/**
 * Exposes the classify-url pipeline step descriptor to engine bundles.
 *
 * The runtime step classifies the input URL against configured rules and emits
 * boolean signals that downstream runIf/skipIf gates consume.
 */

import { parseClassifyUrlStepConfig } from "./classify-url-step-config.js";
import { ClassifyUrlStep } from "./classify-url-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { ClassifyUrlStepOptions } from "./classify-url-step-config.js";

/** Defines the built-in classify-url step type. */
export const classifyUrlStepDescriptor = {
  type: "classify-url",
  parseConfig: parseClassifyUrlStepConfig,
  create: args => new ClassifyUrlStep(args.config, { logger: args.deps.logger })
} satisfies PipelineStepDescriptor<ClassifyUrlStepOptions>;
