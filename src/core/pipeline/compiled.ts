/**
 * Defines the compiled pipeline plan consumed by core runtime code.
 *
 * Engine construction resolves descriptors, config, renderer instances, step
 * instances, and concurrency groups into this framework-free shape. The
 * orchestrator executes the plan but does not know how it was configured.
 */

import type { OutputRenderer } from "../../contracts/extensions/output-renderer.js";
import type { Condition } from "../../contracts/pipeline/condition.js";
import type { PipelineStep } from "../../contracts/pipeline/step.js";
import type { ConcurrencyLimiter } from "../../shared/limiters.js";

/** Binds configured step identity and orchestration policy to executable behavior. */
export interface CompiledPipelineStep {
  readonly name: string;
  readonly type: string;
  readonly timeoutSeconds: number;
  readonly concurrencyGroup?: string;
  readonly runIf?: Condition;
  readonly skipIf?: Condition;
  readonly step: PipelineStep;
}

/** Describes a fully constructed pipeline ready for execution. */
export interface CompiledPipeline {
  readonly name: string;
  readonly renderer: OutputRenderer;
  readonly steps: ReadonlyArray<CompiledPipelineStep>;
  readonly groups: ReadonlyMap<string, ConcurrencyLimiter>;
}
