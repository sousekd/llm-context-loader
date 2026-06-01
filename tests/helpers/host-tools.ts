/** Provides host tool fixtures for tests. */
import type { HostTools, ResourceLoader } from "../../src/contracts/host/host-tools.js";
import { createHostToolsBuilder } from "../../src/app/host-tools.js";
import { httpFetchKey, resourceLoaderKey } from "../../src/contracts/host/host-tools.js";

export function createTestHostTools(
  overrides: {
    readonly httpFetch?: typeof globalThis.fetch;
    readonly resources?: ResourceLoader;
  } = {}
): HostTools {
  const builder = createHostToolsBuilder();
  builder.register(httpFetchKey, overrides.httpFetch ?? defaultFetch);
  builder.register(resourceLoaderKey, overrides.resources ?? defaultResourceLoader);
  return builder.build();
}

const defaultFetch: typeof globalThis.fetch = async () => {
  throw new Error("test host tools: httpFetch not stubbed");
};

const defaultResourceLoader: ResourceLoader = {
  configDir: "/config",
  readText: async () => {
    throw new Error("test host tools: resources not stubbed");
  }
};
