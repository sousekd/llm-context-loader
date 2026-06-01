/**
 * Reads YAML files with duplicate-key rejection for operator configuration.
 *
 * The parser returns opaque data for later shape validation. Duplicate keys are
 * rejected here so accidental overrides do not silently change provider,
 * adapter, or pipeline declarations.
 */

import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

import { ConfigurationError } from "../../shared/errors.js";

/** Reads a YAML document and rejects duplicate keys. */
export async function readYaml(configPath: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(configPath, "utf8");
  } catch (cause) {
    throw new ConfigurationError(`Unable to read YAML configuration file: ${configPath}`, "config_read_failed", {
      cause
    });
  }
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length > 0)
    throw new ConfigurationError(
      `Invalid YAML configuration: ${document.errors.map((error: { readonly message: string }) => error.message).join("; ")}`,
      "invalid_yaml"
    );
  return document.toJSON();
}
