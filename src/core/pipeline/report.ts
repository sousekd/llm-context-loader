/**
 * Finalizes pipeline reports from body versions and step reports.
 *
 * The report rollup is intentionally derived after all effects are applied: a
 * failed step with a body yields `degraded`, a failed run without a body yields
 * `failed`, and an all-ok run with a body yields `ok`.
 */

import type { BodyContent } from "../../contracts/pipeline/context.js";
import type { PipelineReport, StepReport } from "../../contracts/pipeline/report.js";
import type { BodyStore } from "./body.js";

/** Builds the final pipeline report from body versions and step reports. */
export function finalizeReport(args: {
  readonly url: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly body: BodyStore;
  readonly steps: ReadonlyArray<StepReport>;
}): PipelineReport {
  const versions = args.body.versions();
  const first = versions[0];
  const last = versions.at(-1);
  const initialChars = first?.content.length ?? 0;
  const finalChars = last?.content.length ?? 0;
  const failedStep = args.steps.find(step => step.status === "failed");
  const result = finalChars === 0 ? "failed" : failedStep ? "degraded" : "ok";
  const ratio = initialChars > 0 && finalChars > 0 ? Number((finalChars / initialChars).toFixed(3)) : undefined;

  return {
    url: args.url,
    startedAt: args.startedAt,
    durationMs: args.durationMs,
    initialChars,
    finalChars,
    ratio,
    returned: last?.stepName ?? "none",
    result,
    steps: args.steps,
    bodyProducedBy: findBodyProducer(versions, last),
    bodyChangedBy: last?.stepName,
    error: result === "failed" ? describePipelineFailure(args.steps) : undefined
  };
}

/** Returns a terse pipeline failure description for diagnostics. */
function describePipelineFailure(steps: ReadonlyArray<StepReport>): string | undefined {
  const failed = steps.find(step => step.status === "failed");
  return failed ? `${failed.name}: ${failed.reason ?? "failed"}` : undefined;
}

/** Finds the step that first produced the final body bytes. */
function findBodyProducer(
  versions: ReturnType<BodyStore["versions"]>,
  last: BodyContent | undefined
): string | undefined {
  if (!last) return undefined;
  return versions.find(version => version.content === last.content && version.title === last.title)?.stepName;
}
