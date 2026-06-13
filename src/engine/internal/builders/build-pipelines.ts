/**
 * Compiles configured pipeline declarations into executable pipeline plans.
 *
 * Pipeline compilation validates renderer references and enabled-step
 * concurrency groups, diagnostic names, descriptor lookup, config parsing, and
 * factory failures before any request can run. Disabled steps are excluded
 * before those step-level checks so their providers are never required.
 */

import { outputRendererRegistryKey } from "../../../contracts/extensions/output-renderer.js";
import { assertDiagnosticName } from "../../../shared/diagnostic-names.js";
import { ConfigurationError } from "../../../shared/errors.js";
import { createConcurrencyLimiter } from "../../../shared/limiters.js";

import type { ExtensionServices } from "../../../contracts/host/extension-services.js";
import type { HostTools } from "../../../contracts/host/host-tools.js";
import type { PipelineStep, PipelineStepDescriptor } from "../../../contracts/pipeline/step.js";
import type { CompiledPipeline, CompiledPipelineStep } from "../../../core/pipeline/compiled.js";
import type { Logger } from "../../../shared/logger.js";
import type { EngineConfig } from "../../engine-config.js";

/** Constructs resolved pipelines with parsed steps and limiter groups. */
export async function buildPipelines(
  rawPipelines: EngineConfig["pipelines"],
  services: ExtensionServices,
  tools: HostTools,
  logger: Logger,
  descriptors: Readonly<Record<string, PipelineStepDescriptor>>
): Promise<ReadonlyMap<string, CompiledPipeline>> {
  const rendererRegistry = services.require(outputRendererRegistryKey);
  const pipelines = new Map<string, CompiledPipeline>();
  for (const [pipelineName, pipeline] of Object.entries(rawPipelines)) {
    if (!pipeline.enabled) {
      logger.info({ pipeline: pipelineName }, "pipeline disabled; excluded from compilation");
      continue;
    }
    const renderer = rendererRegistry.tryGet(pipeline.outputRenderer);
    if (!renderer)
      throw new ConfigurationError(
        `Pipeline '${pipelineName}' references unknown output renderer: ${pipeline.outputRenderer}`,
        "unknown_pipeline_renderer"
      );
    const groups = new Map(
      Object.entries(pipeline.limiters).map(([name, concurrency]) => [name, createConcurrencyLimiter(concurrency)])
    );
    const seenStepNames = new Set<string>();
    const disabledStepNames: string[] = [];
    const steps: CompiledPipelineStep[] = [];
    for (const common of pipeline.steps) {
      if (common.enabled === false) {
        disabledStepNames.push(common.name);
        continue;
      }
      try {
        assertDiagnosticName(common.name);
      } catch (cause) {
        throw new ConfigurationError(
          `Invalid step name in pipeline ${pipelineName}: ${common.name}`,
          "invalid_step_name",
          { cause }
        );
      }
      if (seenStepNames.has(common.name))
        throw new ConfigurationError(
          `Duplicate step name in pipeline ${pipelineName}: ${common.name}`,
          "duplicate_pipeline_step_name"
        );
      seenStepNames.add(common.name);
      if (common.concurrencyGroup && !groups.has(common.concurrencyGroup))
        throw new ConfigurationError(
          `Pipeline '${pipelineName}' step '${common.name}' references undeclared concurrency group: ${common.concurrencyGroup}`,
          "unknown_concurrency_group"
        );
      const descriptor = descriptors[common.type];
      if (!descriptor) throw new ConfigurationError(`Unknown step type: ${common.type}`, "unknown_step_type");
      let parsed: unknown;
      try {
        parsed = descriptor.parseConfig(common.config);
      } catch (cause) {
        if (cause instanceof ConfigurationError) throw cause;
        throw new ConfigurationError(
          `Invalid config for step '${common.name}' in pipeline '${pipelineName}'`,
          "invalid_step_config",
          {
            cause,
            pipeline: pipelineName,
            step: common.name,
            type: common.type
          }
        );
      }
      let step: PipelineStep;
      try {
        step = await descriptor.create({
          name: common.name,
          type: common.type,
          timeoutSeconds: common.timeoutSeconds,
          config: parsed,
          services,
          deps: { tools, logger: logger.child({ pipeline: pipelineName, step: common.name, type: common.type }) }
        });
      } catch (cause) {
        if (cause instanceof ConfigurationError) throw cause;
        throw new ConfigurationError(
          `Failed to create step '${common.name}' in pipeline '${pipelineName}'`,
          "pipeline_step_create_failed",
          {
            cause,
            pipeline: pipelineName,
            step: common.name,
            type: common.type
          }
        );
      }
      steps.push({
        name: common.name,
        type: common.type,
        timeoutSeconds: common.timeoutSeconds,
        concurrencyGroup: common.concurrencyGroup,
        runIf: common.runIf,
        skipIf: common.skipIf,
        step
      });
    }
    if (disabledStepNames.length > 0)
      logger.info({ pipeline: pipelineName, disabled: disabledStepNames }, "steps disabled; excluded from compilation");
    if (steps.length === 0) logger.warn({ pipeline: pipelineName }, "pipeline compiled with no enabled steps");
    pipelines.set(pipelineName, { name: pipelineName, renderer: renderer.renderer, steps, groups });
  }
  return pipelines;
}
