/**
 * Defines typed host tools available to extension factories.
 *
 * Host tools are stateful single-instance capabilities provided by app
 * assembly, such as resource loading and HTTP fetch. They are looked up in one
 * step by key and are not user-named. Stateless helpers stay in `src/shared/*`
 * and should be imported directly instead of routed through this bag.
 */

import { InternalError } from "../../shared/errors.js";

/** Identifies one typed host tool available to extension factories. */
export interface HostToolKey<TTool> {
  readonly id: string;
  readonly description: string;
}

/** Describes a stable host tool key before generic typing is applied. */
interface HostToolKeyDefinition {
  readonly id: string;
  readonly description: string;
}

/** Provides typed access to host-provided tools. */
export interface HostTools {
  /** Returns a required tool or throws when the host did not register it. */
  require<TTool>(key: HostToolKey<TTool>): TTool;

  /** Returns an optional tool when the host registered it. */
  tryGet<TTool>(key: HostToolKey<TTool>): TTool | undefined;
}

/** Creates a stable typed key for one host tool. */
export function createHostToolKey<TTool>(definition: HostToolKeyDefinition): HostToolKey<TTool> {
  if (!/^llmc\.tools\.[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/.test(definition.id))
    throw new InternalError(`Invalid host tool key: ${definition.id}`, "invalid_host_tool_key");
  return Object.freeze(definition);
}

/** Reads resources relative to the active configuration file. */
export interface ResourceLoader {
  readonly configDir: string;
  readText(path: string): Promise<string>;
}

/** Fetches HTTP resources. Aliased so descriptors do not depend on globalThis. */
export type HttpFetch = typeof globalThis.fetch;

/** Identifies the resource loader host tool. */
export const resourceLoaderKey = createHostToolKey<ResourceLoader>({
  id: "llmc.tools.resourceLoader",
  description: "resource loader"
});

/** Identifies the HTTP fetch host tool. */
export const httpFetchKey = createHostToolKey<HttpFetch>({
  id: "llmc.tools.httpFetch",
  description: "HTTP fetch"
});
