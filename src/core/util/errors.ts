// Shared error contract for cross-layer failures and stable reason mapping.
// `message` may contain untrusted external content; callers should not surface it raw.
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Maximum length of slugified reason codes emitted to diagnostics.
// Keeps unbounded upstream messages out of observability surfaces.
const MAX_REASON_LENGTH = 40;

/** Map unknown errors to bounded machine-readable reason codes. */
export function reasonFromError(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error) {
    const slug = error.message
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return (slug || "unknown_error").slice(0, MAX_REASON_LENGTH);
  }
  return "unknown_error";
}

/** Map unknown errors to an informational display message. */
export function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
