/** Provides direct pipeline-step context fixtures. */
import type { BodyContent, PipelineContext, ScalarValue } from "../../../src/contracts/pipeline/context.js";
import { BodyStore } from "../../../src/core/pipeline/body.js";
import { ReadonlyArtifactBag, ReadonlySignalBag } from "../../../src/core/pipeline/context.js";

/** Body fragment that makes mediaType optional for test ergonomics. */
type BodyInput = { readonly content: string; readonly mediaType?: string; readonly title?: string };

function normalize(body: BodyInput, mediaType: string): BodyContent {
  return { content: body.content, mediaType: body.mediaType ?? mediaType, title: body.title };
}

export function makeStepContext(
  args: {
    readonly body?: BodyInput;
    readonly bodyVersions?: ReadonlyArray<{ readonly stepName: string } & BodyInput>;
    readonly signal?: AbortSignal;
    readonly signals?: ReadonlyMap<string, ScalarValue>;
    readonly artifacts?: ReadonlyMap<string, unknown>;
    readonly url?: string;
  } = {}
): PipelineContext {
  const body = new BodyStore();
  if (args.bodyVersions) {
    for (const version of args.bodyVersions)
      body.append({ stepName: version.stepName, ...normalize(version, "text/markdown") });
  } else if (args.body) {
    body.append({ stepName: "source", ...normalize(args.body, "text/markdown") });
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
