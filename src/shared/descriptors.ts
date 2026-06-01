/**
 * Builds descriptor records for bundle assembly layers.
 *
 * Descriptor bundles are the only production files that aggregate multiple
 * concrete built-ins. This helper keeps duplicate type detection consistent
 * between engine descriptors and HTTP adapter descriptors.
 */

import { InternalError } from "./errors.js";

/** Creates an immutable descriptor record keyed by a descriptor-owned identifier. */
export function createDescriptorRecord<TDescriptor>(
  descriptors: ReadonlyArray<TDescriptor>,
  getKey: (descriptor: TDescriptor) => string
): Readonly<Record<string, TDescriptor>> {
  const entries = new Map<string, TDescriptor>();
  for (const descriptor of descriptors) {
    const key = getKey(descriptor);
    if (entries.has(key)) throw new InternalError(`Duplicate descriptor: ${key}`, "duplicate_descriptor");
    entries.set(key, descriptor);
  }
  return Object.freeze(Object.fromEntries(entries));
}
