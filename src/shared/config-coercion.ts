/**
 * Provides Zod preprocessors for YAML values after environment substitution.
 *
 * YAML placeholders are substituted as strings before schema parsing, so built-in
 * config schemas use these helpers to recover optional numbers and booleans
 * without treating blank environment variables as meaningful values.
 */

/** Treats blank scalar strings as omitted config values. */
export function emptyStringAsUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** Parses strict boolean strings while preserving schema errors for invalid values. */
export function booleanStringAsBooleanOrUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}
