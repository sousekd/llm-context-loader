/**
 * Provides read-only views over orchestrator-owned signal and artifact maps.
 *
 * The maps remain mutable inside the orchestrator while a run progresses, but
 * steps receive these narrow bag interfaces so they can inspect prior effects
 * without mutating runtime state directly.
 */

import type { ArtifactBag, ScalarValue, SignalBag } from "../../contracts/pipeline/context.js";

/** Provides read-only access to scalar step coordination signals. */
export class ReadonlySignalBag implements SignalBag {
  /** Creates a read-only signal view over the mutable runtime map. */
  constructor(private readonly values: ReadonlyMap<string, ScalarValue>) {}

  /** Returns a scalar signal value when present. */
  get(key: string): ScalarValue | undefined {
    return this.values.get(key);
  }

  /** Returns whether the named signal exists. */
  has(key: string): boolean {
    return this.values.has(key);
  }
}

/** Provides read-only access to artifact payloads from earlier steps. */
export class ReadonlyArtifactBag implements ArtifactBag {
  /** Creates a read-only artifact view over the mutable runtime map. */
  constructor(private readonly values: ReadonlyMap<string, unknown>) {}

  /** Returns a typed artifact payload when present. */
  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  /** Returns whether the named artifact exists. */
  has(key: string): boolean {
    return this.values.has(key);
  }
}
