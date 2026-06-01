/**
 * Defines the pipeline step port, descriptor shape, and effect result model.
 *
 * Step implementations are behavior-only runtime objects. Engine construction
 * parses opaque config through descriptors, injects host tools and extension
 * services, and then the orchestrator applies returned effects in canonical
 * body, signal, artifact order.
 */

import type { Logger } from "../../shared/logger.js";
import type { ExtensionServices } from "../host/extension-services.js";
import type { HostTools } from "../host/host-tools.js";
import type { BodyContent, PipelineContext, ScalarValue } from "./context.js";
import type { StepDiagnostics } from "./diagnostics.js";

/** Enumerates the closed status set every step reports. */
export type StepStatus = "ok" | "skipped" | "degraded" | "failed";

/**
 * Describes state changes requested by a step result.
 *
 * Effects on signals and artifacts use `null` to delete an existing key.
 * Effects are applied by the orchestrator on `ok` or `degraded` status only;
 * `skipped` and `failed` results never apply effects. A step combines
 * `status: "degraded"` with effects when it both flags a quality concern and
 * wants to mutate state (for example a quality gate rolling the body back).
 */
export interface StepEffects {
  readonly body?: BodyContent;
  readonly signals?: Record<string, ScalarValue | null>;
  readonly artifacts?: Record<string, unknown | null>;
}

/**
 * Describes the direct result returned by a step execution.
 *
 * `effects` apply only when `status` is `ok` or `degraded`. Combining
 * `degraded` with effects is intentional: it lets a step degrade the
 * pipeline rollup while still mutating state (body rollback, signal flip,
 * artifact write). A `failed` result never mutates state.
 */
export interface StepResult {
  readonly status: StepStatus;
  readonly reason?: string;
  readonly effects?: StepEffects;
  readonly diagnostics?: StepDiagnostics;
}

/** Defines executable step behavior that can inspect context and emit effects. */
export interface PipelineStep {
  /** Executes one step against the read-only context and returns requested effects. */
  run(ctx: PipelineContext): Promise<StepResult>;
}

/** Provides dependencies available while constructing a pipeline step. */
export interface PipelineStepCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one pipeline step instance. */
export interface PipelineStepCreateArgs<TConfig = unknown> {
  readonly name: string;
  readonly type: string;
  readonly timeoutSeconds: number;
  readonly config: TConfig;
  readonly services: ExtensionServices;
  readonly deps: PipelineStepCreateDeps;
}

/** Defines one pipeline step descriptor type addressable from YAML. */
export interface PipelineStepDescriptor<TConfig = unknown> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: PipelineStepCreateArgs<TConfig>): PipelineStep | Promise<PipelineStep>;
}
