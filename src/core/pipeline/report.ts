/**
 * Finalizes pipeline reports from body versions and step reports.
 *
 * The report rollup is intentionally derived after all effects are applied: a
 * failed or degraded step with a body yields `degraded`, a failed run without a
 * body yields `failed`, and an all-ok run with a body yields `ok`.
 *
 * A binary body that reaches the end of the pipeline without conversion produces
 * a failed run with an `unconverted_binary` error.
 */

import { bodyLength } from "../../contracts/pipeline/context.js";
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
  const initialLength = first ? bodyLength(first) : 0;
  const finalLength = last ? bodyLength(last) : 0;
  const terminalBinary = last?.kind === "binary";
  const degradedStep = args.steps.find(step => step.status === "failed" || step.status === "degraded");
  const result = finalLength === 0 || terminalBinary ? "failed" : degradedStep ? "degraded" : "ok";
  const sameKind = first?.kind === last?.kind;
  const ratio =
    sameKind && initialLength > 0 && finalLength > 0 ? Number((finalLength / initialLength).toFixed(3)) : undefined;

  return {
    url: args.url,
    startedAt: args.startedAt,
    durationMs: args.durationMs,
    initialLength,
    finalLength,
    ratio,
    returned: last?.stepName ?? "none",
    result,
    steps: args.steps,
    bodyProducedBy: findBodyProducer(versions, last),
    bodyChangedBy: last?.stepName,
    error: result === "failed" ? (describePipelineFailure(args.steps) ?? terminalBinaryError(last)) : undefined
  };
}

/** Returns a terse pipeline failure description for diagnostics. */
function describePipelineFailure(steps: ReadonlyArray<StepReport>): string | undefined {
  const failed = steps.find(step => step.status === "failed");
  return failed ? `${failed.name}: ${failed.reason ?? "failed"}` : undefined;
}

/** Returns the error message when a binary body reaches the end of the pipeline. */
function terminalBinaryError(last: BodyContent | undefined): string | undefined {
  if (last?.kind === "binary") return `unconverted_binary: ${last.mediaType}`;
  return undefined;
}

/** Finds the step that first produced the final body, comparing by representation kind. */
function findBodyProducer(
  versions: ReturnType<BodyStore["versions"]>,
  last: BodyContent | undefined
): string | undefined {
  if (!last) return undefined;
  return versions.find(version => {
    if (version.kind !== last.kind || version.mediaType !== last.mediaType || version.title !== last.title)
      return false;
    if (last.kind === "text" && version.kind === "text") return version.content === last.content;
    if (last.kind === "binary" && version.kind === "binary") return bytesEqual(version.bytes, last.bytes);
    return false;
  })?.stepName;
}

/** Compares binary payloads by value so copied body snapshots still match their producer. */
function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}
