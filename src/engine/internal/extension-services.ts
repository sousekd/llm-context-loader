/**
 * Creates the mutable extension-service builder used during engine construction.
 *
 * The builder is internal to the engine. Extension factories receive the
 * immutable `ExtensionServices` view after provider and renderer registries have
 * been registered.
 */

import { createKeyedRegistryBuilder, type KeyedRegistryBuilder } from "../../shared/keyed-registry-builder.js";

import type { ExtensionServices } from "../../contracts/host/extension-services.js";

/** Registers extension services before exposing an immutable service view. */
export type ExtensionServicesBuilder = KeyedRegistryBuilder<ExtensionServices>;

/** Creates an empty extension services builder. */
export function createExtensionServicesBuilder(): ExtensionServicesBuilder {
  return createKeyedRegistryBuilder<ExtensionServices>({
    label: "extension service",
    missingCode: "missing_extension_service",
    duplicateCode: "duplicate_extension_service"
  });
}
