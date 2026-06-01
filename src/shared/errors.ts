/**
 * Defines the service error taxonomy and upstream-code sanitization boundary.
 *
 * The four intentional error classes split failures by audience: callers see
 * `ClientError`, operators see `ConfigurationError`, pipeline steps degrade
 * provider failures through `UpstreamError`, and unexpected bugs become
 * `InternalError`. `UpstreamError` owns the sanitizeUpstreamCode security
 * boundary so untrusted external content cannot leak arbitrary identifiers into
 * logs or rendered diagnostics.
 */

const MAX_UPSTREAM_CODE_LENGTH = 40;

/** Base class for every error this service raises intentionally. */
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  /** Creates a base error with a stable string code. */
  constructor(message: string, code: string, details?: unknown, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }

  /** Returns the safe diagnostic representation for rendered failure reports. */
  toDiagnosticString(): string {
    return this.code;
  }
}

/** Represents a 4xx-class failure caused by the caller's request. */
export class ClientError extends BaseError {
  public readonly statusCode: number;

  /** Creates a client error with an HTTP 4xx status. */
  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message, code, details);
    if (statusCode < 400 || statusCode >= 500) throw new Error(`ClientError statusCode must be 4xx, got ${statusCode}`);
    this.statusCode = statusCode;
  }

  /** Returns a caller-safe diagnostic string. */
  override toDiagnosticString(): string {
    return `${this.code}: ${this.message}`;
  }
}

/** Represents invalid operator-provided startup or app assembly configuration. */
export class ConfigurationError extends BaseError {
  /** Creates a configuration error with an optional stable code. */
  constructor(message: string, code = "configuration_error", details?: unknown) {
    super(message, code, details, extractCause(details));
  }
}

/**
 * Represents a degradable failure from an external service. The raw
 * upstream code is sanitized at construction so producers cannot forget
 * the sanitizeUpstreamCode security boundary.
 */
export class UpstreamError extends BaseError {
  public readonly upstreamCode: string;
  public readonly upstreamStatus?: number;

  /** Creates an upstream error with a sanitized upstream code. */
  constructor(
    message: string,
    rawCode: unknown,
    details?: { readonly upstreamStatus?: number; readonly cause?: unknown }
  ) {
    super(message, "upstream_error", undefined, details?.cause);
    this.upstreamCode = sanitizeUpstreamCode(rawCode);
    this.upstreamStatus = details?.upstreamStatus;
  }

  /** Returns a diagnostic string with only sanitized upstream identifiers. */
  override toDiagnosticString(): string {
    return `${this.code}: ${this.upstreamCode}`;
  }
}

/** Represents a bug or unexpected condition that should produce a 500. */
export class InternalError extends BaseError {
  /** Creates an internal error with an optional stable code. */
  constructor(message: string, code = "internal_error", details?: unknown) {
    super(message, code, details, extractCause(details));
  }
}

/** Bounds and slugifies upstream error identifiers before diagnostics or logs. */
export function sanitizeUpstreamCode(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? "unknown_error");
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (slug || "unknown_error").slice(0, MAX_UPSTREAM_CODE_LENGTH);
}

/** Detects DOM abort errors produced by fetch-compatible APIs. */
export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/** Extracts a native error cause from detail payloads used by internal errors. */
function extractCause(details: unknown): unknown {
  if (details instanceof Error) return details;
  if (!details || typeof details !== "object" || !("cause" in details)) return undefined;
  return (details as { readonly cause?: unknown }).cause;
}
