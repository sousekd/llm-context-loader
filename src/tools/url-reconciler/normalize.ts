import type { NormalizedUrl, NormalizeUrlsOptions, UrlParseFailure } from "./types.js";

// WHATWG URL normalization for URL reconciliation primitives.
// Parsing never throws to callers; unsupported schemes are reported as parse failures.

const DEFAULT_ALLOWED_SCHEMES = ["http:", "https:"] as const;

/** Normalize a URL into comparison keys or return a parse failure. */
export function normalizeUrlForComparison(rawUrl: string, options: NormalizeUrlsOptions = {}): NormalizedUrl | UrlParseFailure {
  const normalizedInput = decodeCommonHtmlEntities(rawUrl).trim();
  if (normalizedInput.length === 0) {
    return { kind: "parse_failure", rawUrl, normalizedInput, reason: "empty" };
  }

  const parsed = parseUrl(normalizedInput, options.baseUrl);
  if (!parsed) {
    return { kind: "parse_failure", rawUrl, normalizedInput, reason: "invalid" };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (!allowedSchemes(options).has(scheme)) {
    return { kind: "parse_failure", rawUrl, normalizedInput, reason: "unsupported_scheme", scheme: scheme.slice(0, -1) };
  }

  return {
    kind: "url",
    rawUrl,
    href: parsed.href,
    hrefKey: parsed.href,
    strictKey: `${scheme}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`,
    fetchKey: `${scheme}//${parsed.host}${parsed.pathname}${parsed.search}`,
    scheme: scheme.slice(0, -1),
    host: parsed.hostname.toLowerCase(),
    path: parsed.pathname,
    search: parsed.search,
    queryKey: queryKey(parsed.searchParams),
    fragment: parsed.hash
  };
}

/** Decode common HTML entities that are found in markdown URLs. */
export function decodeCommonHtmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#39);/gi, (entity) => {
    const lower = entity.toLowerCase();
    if (lower === "&amp;") return "&";
    if (lower === "&lt;") return "<";
    if (lower === "&gt;") return ">";
    if (lower === "&quot;") return '"';
    if (lower === "&apos;" || lower === "&#39;") return "'";
    return entity;
  });
}

/** Normalize anchor text for exact lookup. */
export function normalizeAnchorText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Normalize a path for host-typo lookup with trailing-slash tolerance. */
export function normalizePathVariant(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

/** Build an order-insensitive query key. */
export function queryKey(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** Parse a URL without throwing. */
function parseUrl(value: string, baseUrl: string | undefined): URL | undefined {
  try {
    return baseUrl ? new URL(value, baseUrl) : new URL(value);
  } catch {
    return undefined;
  }
}

/** Build the normalized scheme allowlist. */
function allowedSchemes(options: NormalizeUrlsOptions): ReadonlySet<string> {
  const values = options.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;
  return new Set(values.map((scheme) => (scheme.endsWith(":") ? scheme : `${scheme}:`).toLowerCase()));
}
