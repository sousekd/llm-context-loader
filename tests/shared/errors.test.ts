/** Verifies the shared intentional-error taxonomy and safe diagnostic surfaces. */
import { describe, expect, it } from "vitest";

import {
  ClientError,
  ConfigurationError,
  InternalError,
  UpstreamError,
  isAbortError,
  sanitizeUpstreamCode
} from "../../src/shared/errors.js";

describe("shared error taxonomy", () => {
  it("includes caller-safe messages only for client diagnostics", () => {
    const client = new ClientError("Bad URL", "invalid_url", 400);
    const configuration = new ConfigurationError("Missing secret", "missing_env");
    const internal = new InternalError("secret stack detail", "internal_secret");

    expect(client.toDiagnosticString()).toBe("invalid_url: Bad URL");
    expect(configuration.toDiagnosticString()).toBe("missing_env");
    expect(internal.toDiagnosticString()).toBe("internal_secret");
  });

  it("rejects non-4xx client statuses at construction", () => {
    expect(() => new ClientError("bad", "bad_status", 500)).toThrow("ClientError statusCode must be 4xx");
  });

  it("sanitizes upstream codes before diagnostics", () => {
    const error = new UpstreamError("provider said too much", "Rate; Limit!!", { upstreamStatus: 429 });

    expect(error.toDiagnosticString()).toBe("upstream_error: rate_limit");
    expect(error.upstreamCode).toBe("rate_limit");
    expect(error.upstreamStatus).toBe(429);
  });

  it("bounds and defaults sanitized upstream codes", () => {
    expect(sanitizeUpstreamCode("   ")).toBe("unknown_error");
    expect(sanitizeUpstreamCode(new Error("Network Down"))).toBe("network_down");
    expect(sanitizeUpstreamCode("A".repeat(60))).toHaveLength(40);
  });

  it("preserves native causes for structured logging", () => {
    const cause = new Error("root cause");

    expect(new ConfigurationError("bad config", "bad_config", { cause }).cause).toBe(cause);
    expect(new InternalError("bug", "bug", cause).cause).toBe(cause);
    expect(new UpstreamError("bad upstream", "network", { cause }).cause).toBe(cause);
  });

  it("recognizes DOM and Error abort failures", () => {
    const domAbort = new DOMException("aborted", "AbortError");
    const namedAbort = new Error("aborted");
    namedAbort.name = "AbortError";

    expect(isAbortError(domAbort)).toBe(true);
    expect(isAbortError(namedAbort)).toBe(true);
    expect(isAbortError(new Error("other"))).toBe(false);
  });
});
