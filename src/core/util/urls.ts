import { AppError } from "./errors.js";

// URL normalization and validation helpers used at request boundaries.
// This module owns the HTTP/HTTPS scheme allowlist security boundary.
/** Parse and normalize a URL and reject unsupported schemes. */
export function validateHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(`Invalid URL: ${value}`, "invalid_url", 400);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(`Unsupported URL scheme: ${url.protocol}`, "unsupported_url_scheme", 400);
  }

  return url.toString();
}

/** Join a base URL and path with exactly one separating slash. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/g, "")}/${path.replace(/^\/+/, "")}`;
}
