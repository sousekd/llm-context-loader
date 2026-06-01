/**
 * Exposes the load-source pipeline step descriptor to engine bundles.
 *
 * Construction resolves the configured source provider by name so runtime step
 * execution only depends on the provider port and logger.
 */

import { sourceProviderRegistryKey } from "../../../contracts/extensions/source-provider.js";
import { parseLoadSourceStepConfig } from "./load-source-step-config.js";
import { LoadSourceStep } from "./load-source-step.js";

import type { PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { LoadSourceStepConfig } from "./load-source-step-config.js";

/** Defines the built-in load-source step type. */
export const loadSourceStepDescriptor = {
  type: "load-source",
  parseConfig: parseLoadSourceStepConfig,
  create: args => {
    const sourceProvider = args.services.require(sourceProviderRegistryKey).require(args.config.provider).provider;
    return new LoadSourceStep({ sourceProvider, logger: args.deps.logger });
  }
} satisfies PipelineStepDescriptor<LoadSourceStepConfig>;
