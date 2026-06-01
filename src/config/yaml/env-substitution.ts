/**
 * Substitutes environment placeholders inside loaded YAML values.
 *
 * Substitution is string-only and runs before Zod parsing. Later schemas recover
 * numbers and booleans where fields define those types, while opaque payloads
 * such as provider `extraBody` preserve YAML values except for string leaves.
 */

import { ConfigurationError } from "../../shared/errors.js";

/** Recursively substitutes environment placeholders in YAML scalar strings. */
export function substituteEnv(value: unknown, env: NodeJS.ProcessEnv, path: ReadonlyArray<string> = []): unknown {
  if (typeof value === "string") return substituteString(value, env, path.join("."));
  if (Array.isArray(value)) return value.map((item, index) => substituteEnv(item, env, [...path, String(index)]));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, substituteEnv(child, env, [...path, key])])
    );
  }
  return value;
}

/** Resolves one YAML string using the supported environment substitution grammar. */
function substituteString(value: string, env: NodeJS.ProcessEnv, path: string): string {
  const literalMarker = "\u0000LITERAL_ENV_OPEN\u0000";
  const protectedValue = value.replace(/\$\$\{/g, literalMarker);
  const substituted = protectedValue.replace(
    /\$\{([A-Z0-9_]+)(:-([^}]*))?\}/g,
    (_match, key: string, _defaultExpr: string | undefined, fallback: string | undefined) => {
      const envValue = env[key];
      if (fallback !== undefined) return envValue ? envValue : fallback;
      if (envValue === undefined) throw new ConfigurationError(`${path}: required env ${key} not set`, "missing_env");
      return envValue;
    }
  );
  return substituted.replaceAll(literalMarker, "${");
}
