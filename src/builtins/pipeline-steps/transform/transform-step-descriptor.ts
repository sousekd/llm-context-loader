/**
 * Exposes the transform pipeline step descriptor to engine bundles.
 *
 * Construction resolves the configured content transformer by name so runtime
 * step execution only depends on the transformer port, target, and logger.
 */

import { contentTransformerRegistryKey } from "../../../contracts/extensions/content-transformer.js";
import { parseTransformStepConfig } from "./transform-step-config.js";
import { TransformStep } from "./transform-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { TransformStepConfig } from "./transform-step-config.js";

/** Defines the built-in transform step type. */
export const transformStepDescriptor = {
  type: "transform",
  parseConfig: parseTransformStepConfig,
  create: args => {
    const transformer = args.services
      .require(contentTransformerRegistryKey)
      .require(args.config.transformer).transformer;
    return new TransformStep(
      {
        target: args.config.target,
        onUnsupported: args.config.onUnsupported,
        emitDiagnostics: args.config.emitDiagnostics
      },
      { transformer, logger: args.deps.logger }
    );
  }
} satisfies PipelineStepDescriptor<TransformStepConfig>;
