/**
 * Validates and joins URLs at the framework-free security boundary.
 *
 * User-supplied URLs are untrusted external content. The service accepts only
 * absolute `http:` and `https:` URLs, and adapters rely on this helper before a
 * URL reaches source providers or pipeline execution.
 */

import { ClientError } from "./errors.js";

/** Validates that a user-supplied URL is absolute HTTP(S). */
export function parseHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ClientError("URL must be absolute", "invalid_url", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new ClientError("URL must use http or https", "invalid_url", 400);

  return parsed.toString();
}

/** Joins a base URL with a path without dropping the base pathname. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return new URL(relative, base).toString();
}
