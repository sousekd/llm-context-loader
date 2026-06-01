/** Provides shared conformance assertions for pipeline steps. */
import { expect } from "vitest";

import type { PipelineContext } from "../../src/contracts/pipeline/context.js";
import type { PipelineStep } from "../../src/contracts/pipeline/step.js";

export function assertPipelineStepIdentity(step: PipelineStep): void {
  expect(step.run).toEqual(expect.any(Function));
}

export async function assertPipelineStepRunsCleanly(step: PipelineStep, ctx: PipelineContext): Promise<void> {
  const result = await step.run(ctx);
  expect(["ok", "skipped", "failed"]).toContain(result.status);
}
