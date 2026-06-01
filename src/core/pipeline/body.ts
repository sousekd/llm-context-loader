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
    this.bodyVersions.push({ ...version });
  }

  /** Returns the current markdown body, if any. */
  current(): BodyContent | undefined {
    const latest = this.bodyVersions.at(-1);
    return latest ? { content: latest.content, title: latest.title } : undefined;
  }

  /** Returns an immutable snapshot of all body versions. */
  versions(): ReadonlyArray<BodyVersion> {
    return this.bodyVersions.map(version => ({ ...version }));
  }
}
