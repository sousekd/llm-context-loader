/**
 * Defines typed construction-time services available to extension factories.
 *
 * Extension services are named registries of configured runtime instances, such
 * as source providers, LLM providers, and output renderers. They differ from
 * host tools because callers first resolve the service by key, then resolve a
 * user-declared instance by name.
 */

import { InternalError } from "../../shared/errors.js";

/** Identifies one typed service available to extension factories. */
export interface ExtensionServiceKey<TService> {
  readonly id: string;
  readonly description: string;
}

/** Describes a stable extension service key before generic typing is applied. */
interface ExtensionServiceKeyDefinition {
  readonly id: string;
  readonly description: string;
}

/** Provides typed access to construction-time extension host services. */
export interface ExtensionServices {
  /** Returns a required service or throws when the host did not register it. */
  require<TService>(key: ExtensionServiceKey<TService>): TService;

  /** Returns an optional service when the host registered it. */
  tryGet<TService>(key: ExtensionServiceKey<TService>): TService | undefined;
}

/** Creates a stable typed key for one extension service. */
export function createExtensionServiceKey<TService>(
  definition: ExtensionServiceKeyDefinition
): ExtensionServiceKey<TService> {
  if (!/^llmc\.[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/.test(definition.id))
    throw new InternalError(`Invalid extension service key: ${definition.id}`, "invalid_extension_service_key");
  return Object.freeze(definition);
}
