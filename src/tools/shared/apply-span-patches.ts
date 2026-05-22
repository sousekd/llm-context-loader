// Generic span patching for reconciliation tools that rewrite known ranges.
// Offsets are interpreted against the original source; overlapping spans are rejected.

export interface SpanPatch {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

/** Apply non-overlapping source spans from right to left. */
export function applySpanPatches(source: string, patches: readonly SpanPatch[]): string {
  const ordered = [...patches].sort((left, right) => right.start - left.start || right.end - left.end);
  assertValidPatches(source, ordered);

  let output = source;
  for (const patch of ordered) {
    output = `${output.slice(0, patch.start)}${patch.replacement}${output.slice(patch.end)}`;
  }

  return output;
}

/** Validate span order, bounds, and overlap. */
function assertValidPatches(source: string, ordered: readonly SpanPatch[]): void {
  let nextStart = source.length;
  for (const patch of ordered) {
    if (!Number.isInteger(patch.start) || !Number.isInteger(patch.end)) {
      throw new Error("Span patch boundaries must be integers");
    }

    if (patch.start < 0 || patch.end < patch.start || patch.end > source.length) {
      throw new Error("Span patch boundaries are out of range");
    }

    if (patch.end > nextStart) {
      throw new Error("Span patches must not overlap");
    }

    nextStart = patch.start;
  }
}
