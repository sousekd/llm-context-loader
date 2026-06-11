/**
 * Substitutes environment placeholders inside loaded YAML values.
 *
 * Substitution is string-only and runs before Zod parsing. Later schemas recover
 * numbers and booleans where fields define those types, while opaque payloads
 * such as provider `extraBody` preserve YAML values except for string leaves.
 *
 * A missing `${VAR}` with no `:-` default resolves to `""` so that the env layer
 * never throws for unused config. Required-ness is owned by reachable built-in
 * schemas, not by substitution.
 */

/** Recursively substitutes environment placeholders in YAML scalar strings. */
export function substituteEnv(value: unknown, env: NodeJS.ProcessEnv): unknown {
  if (typeof value === "string") return substituteString(value, env);
  if (Array.isArray(value)) return value.map((item, index) => substituteEnv(item, env));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, substituteEnv(child, env)]));
  }
  return value;
}

/** Resolves one YAML string using the supported environment substitution grammar. */
function substituteString(value: string, env: NodeJS.ProcessEnv): string {
  const literalMarker = "\u0000LITERAL_ENV_OPEN\u0000";
  const protectedValue = value.replace(/\$\$\{/g, literalMarker);
  const substituted = protectedValue.replace(
    /\$\{([A-Z0-9_]+)(:-([^}]*))?\}/g,
    (_match, key: string, _defaultExpr: string | undefined, fallback: string | undefined) => {
      const envValue = env[key];
      if (fallback !== undefined) return envValue ? envValue : fallback;
      return envValue ?? "";
    }
  );
  return substituted.replaceAll(literalMarker, "${");
}
