/**
 * Stores immutable body versions owned by one pipeline run.
 *
 * Steps can read body state through `BodyView`, but only the orchestrator can
 * append versions after applying `StepEffects`. Snapshots are copied on read so
 * step implementations cannot mutate earlier body versions by reference.
 */

import type { BodyContent, BodyVersion, BodyView } from "../../contracts/pipeline/context.js";

/** Stores immutable snapshots of body versions produced by pipeline steps. */
export class BodyStore implements BodyView {
  private readonly bodyVersions: BodyVersion[] = [];

  /** Appends a new body version and makes it current. */
  append(version: BodyVersion): void {
    this.bodyVersions.push(cloneBodyVersion(version));
  }

  /** Returns the current content-typed body, if any. */
  current(): BodyContent | undefined {
    const latest = this.bodyVersions.at(-1);
    if (!latest) return undefined;
    return cloneBodyContent(latest);
  }

  /** Returns an immutable snapshot of all body versions. */
  versions(): ReadonlyArray<BodyVersion> {
    return this.bodyVersions.map(cloneBodyVersion);
  }
}

/** Copies one body while preserving the representation arm. */
function cloneBodyContent(body: BodyContent): BodyContent {
  if (body.kind === "text")
    return { kind: "text", mediaType: body.mediaType, content: body.content, title: body.title };
  return { kind: "binary", mediaType: body.mediaType, bytes: new Uint8Array(body.bytes), title: body.title };
}

/** Copies one stored body version while preserving the step that produced it. */
function cloneBodyVersion(version: BodyVersion): BodyVersion {
  return { ...cloneBodyContent(version), stepName: version.stepName };
}
