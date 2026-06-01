/**
 * Creates resource loaders for files referenced by YAML-backed descriptors.
 *
 * Prompt templates and future descriptor resources resolve relative to the
 * active config directory, keeping descriptor implementations independent of the
 * process current working directory.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConfigurationError } from "../shared/errors.js";

import type { ResourceLoader } from "../contracts/host/host-tools.js";

/** Creates a resource loader rooted at the active config directory. */
export function createResourceLoader(configDir: string): ResourceLoader {
  return {
    configDir,
    readText: async path => {
      const resolved = resolve(configDir, path);
      try {
        return await readFile(resolved, "utf8");
      } catch (cause) {
        throw new ConfigurationError(`Unable to read resource: ${path}`, "resource_read_failed", {
          cause,
          path: resolved
        });
      }
    }
  };
}
