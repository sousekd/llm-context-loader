/**
 * Executes compiled pipelines with timing, abort handling, effects, and reports.
 *
 * The orchestrator owns mutable per-run state and is the only core component
 * that applies step effects. It receives a logger already bound with
 * `{ component: "orchestrator" }`; request correlation fields come from the
 * logger mixin, and per-call fields are passed inline on each log statement.
 */

import { randomUUID } from "node:crypto";

import { InternalError, isAbortError } from "../../shared/errors.js";
import { getRequestContext, runWithRequestContext, withChildRequestContext } from "../../shared/request-context.js";
import { BodyStore } from "./body.js";
import { resolveStepGate } from "./conditions.js";
import { ReadonlyArtifactBag, ReadonlySignalBag } from "./context.js";
import { applyStepEffects } from "./effects.js";
import { finalizeReport } from "./report.js";

import {
  bodyLength,
  type PipelineContext,
  type PipelineInput,
  type ScalarValue
} from "../../contracts/pipeline/context.js";

import type { PipelineRunResult, StepOutcome, StepReport } from "../../contracts/pipeline/report.js";
import type { StepResult } from "../../contracts/pipeline/step.js";
import type { Logger } from "../../shared/logger.js";
import type { CompiledPipeline, CompiledPipelineStep } from "./compiled.js";

/** Provides an injectable time source for deterministic tests. */
export interface Clock {
  now(): number;
}

/** Describes dependencies required by the pipeline orchestrator. */
export interface PipelineOrchestratorDeps {
  readonly logger: Logger;
  readonly clock?: Clock;
}

/** Uses the process clock for production pipeline timing. */
class SystemClock implements Clock {
  /** Returns the current epoch timestamp in milliseconds. */
  now(): number {
    return Date.now();
  }
}

/** Tracks mutable state for one in-flight pipeline run. */
interface RuntimeState {
  readonly body: BodyStore;
  readonly signals: Map<string, ScalarValue>;
  readonly artifacts: Map<string, unknown>;
  readonly outcomes: StepOutcome[];
  readonly reports: StepReport[];
}

/** Pairs a compiled step with its zero-based index in the pipeline. */
interface IndexedStep {
  readonly entry: CompiledPipelineStep;
  readonly index: number;
}

/** Executes resolved pipelines and records step outcomes. */
export class PipelineOrchestrator {
  private readonly logger: Logger;
  private readonly clock: Clock;

  /** Creates an orchestrator for resolved pipelines. */
  constructor(deps: PipelineOrchestratorDeps) {
    this.logger = deps.logger;
    this.clock = deps.clock ?? new SystemClock();
  }

  /** Runs a pipeline for one URL input and returns the final body plus report. */
  async run(pipeline: CompiledPipeline, input: PipelineInput): Promise<PipelineRunResult> {
    const runId = randomUUID();
    const partial = { run_id: runId, url: input.url };
    const execute = () => this.runWithinScope(pipeline, input);
    if (getRequestContext()) return withChildRequestContext(partial, execute);
    return runWithRequestContext({ request_id: randomUUID(), ...partial }, execute);
  }

  /** Executes the pipeline inside an active request-context scope. */
  private async runWithinScope(pipeline: CompiledPipeline, input: PipelineInput): Promise<PipelineRunResult> {
    const startedAt = this.clock.now();
    const state: RuntimeState = {
      body: new BodyStore(),
      signals: new Map(),
      artifacts: new Map(),
      outcomes: [],
      reports: []
    };
    const indexed: IndexedStep[] = pipeline.steps.map((entry, index) => ({ entry, index }));

    this.logger.info({ pipeline: pipeline.name, step_count: indexed.length }, "Pipeline starting...");

    for (const group of coalesceAdjacentGroups(indexed)) await this.runGroup(group, pipeline, input, state, startedAt);

    const durationMs = this.clock.now() - startedAt;
    const report = finalizeReport({ url: input.url, startedAt, durationMs, body: state.body, steps: state.reports });
    this.logger.info(
      {
        pipeline: pipeline.name,
        duration_ms: durationMs,
        result: report.result,
        final_length: report.finalLength,
        initial_length: report.initialLength,
        returned: report.returned
      },
      "Pipeline finished."
    );
    return { body: state.body.current(), report, signals: new Map(state.signals), artifacts: new Map(state.artifacts) };
  }

  /** Runs adjacent steps under a shared limiter when they have one. */
  private async runGroup(
    group: ReadonlyArray<IndexedStep>,
    pipeline: CompiledPipeline,
    input: PipelineInput,
    state: RuntimeState,
    startedAt: number
  ): Promise<void> {
    const groupName = group[0]?.entry.concurrencyGroup;
    const limiter = groupName ? pipeline.groups.get(groupName) : undefined;
    const runSteps = async (): Promise<void> => {
      for (const step of group) await this.runOneStep(step, pipeline, input, state, startedAt);
    };

    if (!limiter) {
      await runSteps();
      return;
    }

    const first = group[0];
    if (!first) return;
    const waitTimeoutSeconds = Math.max(...group.map(step => step.entry.timeoutSeconds));
    const waitStartedAt = this.clock.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), waitTimeoutSeconds * 1000);
    let acquired = false;

    try {
      await limiter.acquire(async () => {
        acquired = true;
        clearTimeout(timer);
        await runSteps();
      }, controller.signal);
    } catch (error) {
      if (!acquired && isAbortError(error))
        this.recordStepResult(first, pipeline, { status: "failed", reason: "timeout" }, state, waitStartedAt);
      else throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Runs one step and records its outcome and diagnostic report. */
  private async runOneStep(
    step: IndexedStep,
    pipeline: CompiledPipeline,
    input: PipelineInput,
    state: RuntimeState,
    startedAt: number
  ): Promise<void> {
    const { entry, index } = step;
    const current = state.body.current();
    const inputLength = current ? bodyLength(current) : undefined;
    const stepStartedAt = this.clock.now();

    const gateReason = resolveStepGate(entry, name => state.signals.get(name));
    if (gateReason) {
      this.recordStepResult(
        step,
        pipeline,
        { status: "skipped", reason: gateReason },
        state,
        stepStartedAt,
        inputLength
      );
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), entry.timeoutSeconds * 1000);
    let result: StepResult;

    this.logger.debug(
      { pipeline: pipeline.name, step: entry.name, type: entry.type, step_index: index, input_length: inputLength },
      "Step starting..."
    );

    try {
      const ctx = this.createContext(input, state, startedAt, controller.signal);
      result = await entry.step.run(ctx);
    } catch (error) {
      if (isAbortError(error)) {
        result = { status: "failed", reason: "timeout" };
      } else {
        const internal =
          error instanceof InternalError ? error : new InternalError("Step threw an unexpected error", "thrown", error);
        this.logger.error(
          {
            pipeline: pipeline.name,
            step: entry.name,
            type: entry.type,
            step_index: index,
            err: internal
          },
          "Step threw an unexpected error."
        );
        result = { status: "failed", reason: "thrown" };
      }
    } finally {
      clearTimeout(timer);
    }

    this.recordStepResult(step, pipeline, result, state, stepStartedAt, inputLength);
  }

  /** Applies a step result and appends its outcome and report records. */
  private recordStepResult(
    step: IndexedStep,
    pipeline: CompiledPipeline,
    result: StepResult,
    state: RuntimeState,
    stepStartedAt: number,
    inputLength?: number
  ): void {
    const { entry, index } = step;
    const applied = applyStepEffects(entry.name, result, state);
    const outcome: StepOutcome = {
      name: entry.name,
      type: entry.type,
      status: result.status,
      reason: result.reason,
      inputLength,
      outputLength: applied.outputLength
    };
    const durationMs = this.clock.now() - stepStartedAt;
    const report: StepReport = { ...outcome, startedAt: stepStartedAt, durationMs, diagnostics: result.diagnostics };
    state.outcomes.push(outcome);
    state.reports.push(report);

    const baseFields = {
      pipeline: pipeline.name,
      step: entry.name,
      type: entry.type,
      step_index: index,
      status: result.status,
      reason: result.reason,
      duration_ms: durationMs,
      output_length: applied.outputLength,
      upstream_code: result.diagnostics?.attributes?.["upstream_code"],
      upstream_status: result.diagnostics?.attributes?.["upstream_status"]
    };

    if (result.status === "failed") {
      this.logger.warn(baseFields, "Step failed.");
      return;
    }
    if (result.status === "degraded") {
      this.logger.warn(baseFields, "Step degraded.");
      return;
    }
    this.logger.debug(baseFields, "Step finished.");
  }

  /** Creates the per-step context from the current runtime state. */
  private createContext(
    input: PipelineInput,
    state: RuntimeState,
    startedAt: number,
    signal: AbortSignal
  ): PipelineContext {
    return {
      input,
      startedAt,
      signal,
      outcomes: [...state.outcomes],
      body: state.body,
      signals: new ReadonlySignalBag(state.signals),
      artifacts: new ReadonlyArtifactBag(state.artifacts)
    };
  }
}

/**
 * Groups adjacent steps that share the same concurrency group.
 *
 * Adjacency contract: steps sharing a `concurrencyGroup` share one limiter
 * slot only when they appear consecutively in YAML order. Reordering steps
 * — or inserting a step with a different (or no) group between them — splits
 * the group into separate acquisitions and changes locking behavior.
 */
export function coalesceAdjacentGroups(steps: ReadonlyArray<IndexedStep>): ReadonlyArray<ReadonlyArray<IndexedStep>> {
  const groups: IndexedStep[][] = [];
  let current: IndexedStep[] = [];
  let currentGroup: string | undefined;

  for (const step of steps) {
    if (!step.entry.concurrencyGroup) {
      if (current.length > 0) groups.push(current);
      groups.push([step]);
      current = [];
      currentGroup = undefined;
      continue;
    }

    if (step.entry.concurrencyGroup === currentGroup) {
      current.push(step);
      continue;
    }

    if (current.length > 0) groups.push(current);
    current = [step];
    currentGroup = step.entry.concurrencyGroup;
  }

  if (current.length > 0) groups.push(current);
  return groups;
}
