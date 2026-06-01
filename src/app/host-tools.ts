/**
 * Creates the mutable host-tool builder used during app assembly.
 *
 * App assembly registers process-level host capabilities and then gives
 * extension factories the immutable `HostTools` view.
 */

import { createKeyedRegistryBuilder, type KeyedRegistryBuilder } from "../shared/keyed-registry-builder.js";

import type { HostTools } from "../contracts/host/host-tools.js";

/** Registers host tools before exposing an immutable tool view. */
export type HostToolsBuilder = KeyedRegistryBuilder<HostTools>;

/** Creates an empty host tools builder. */
export function createHostToolsBuilder(): HostToolsBuilder {
  return createKeyedRegistryBuilder<HostTools>({
    label: "host tool",
    missingCode: "missing_host_tool",
    duplicateCode: "duplicate_host_tool"
  });
}
