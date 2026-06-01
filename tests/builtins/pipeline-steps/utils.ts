/** Provides direct pipeline-step context fixtures. */
import type { BodyContent, PipelineContext, ScalarValue } from "../../../src/contracts/pipeline/context.js";
import { BodyStore } from "../../../src/core/pipeline/body.js";
import { ReadonlyArtifactBag, ReadonlySignalBag } from "../../../src/core/pipeline/context.js";

export function makeStepContext(
  args: {
    readonly body?: BodyContent;
    readonly bodyVersions?: ReadonlyArray<{ readonly stepName: string } & BodyContent>;
    readonly signal?: AbortSignal;
    readonly signals?: ReadonlyMap<string, ScalarValue>;
    readonly artifacts?: ReadonlyMap<string, unknown>;
    readonly url?: string;
  } = {}
): PipelineContext {
  const body = new BodyStore();
  if (args.bodyVersions) {
    for (const version of args.bodyVersions) body.append({ ...version });
  } else if (args.body) {
    body.append({ stepName: "source", ...args.body });
  }
  return {
    input: { url: args.url ?? "https://example.com/" },
    startedAt: 1,
    signal: args.signal ?? new AbortController().signal,
    outcomes: [],
    body,
    signals: new ReadonlySignalBag(new Map(args.signals ?? new Map())),
    artifacts: new ReadonlyArtifactBag(new Map(args.artifacts ?? new Map()))
  };
}
