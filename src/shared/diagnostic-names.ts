/**
 * Validates names that become diagnostic XML elements or attributes.
 *
 * The diagnostic footer treats step names, child report node names, and
 * diagnostic attribute keys as XML names. Keeping this validator framework-free
 * lets config parsing, pipeline construction, and renderers share one boundary.
 */

import { InternalError } from "./errors.js";

const DIAGNOSTIC_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Returns whether a value is safe for diagnostic XML names and signal keys. */
export function isDiagnosticName(name: string): boolean {
  return DIAGNOSTIC_NAME_PATTERN.test(name);
}

/** Validates a diagnostic element, attribute, or step name. */
export function assertDiagnosticName(name: string): void {
  if (!isDiagnosticName(name)) throw new InternalError(`Invalid diagnostic name: ${name}`, "invalid_diagnostic_name");
}
