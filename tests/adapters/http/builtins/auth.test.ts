/** Verifies per-adapter bearer auth enforcement. */
import { describe, expect, it } from "vitest";

import { enforceBearerAuth, warnIfBearerAuthDisabled } from "../../../../src/adapters/http/builtins/auth.js";
import { ClientError } from "../../../../src/shared/errors.js";
import { createTestLogger, type CapturedLog } from "../../../helpers/logger.js";

import type { FastifyRequest } from "fastify";

describe("enforceBearerAuth", () => {
  it("returns when auth config is omitted", () => {
    expect(() => enforceBearerAuth(undefined, request())).not.toThrow();
  });

  it("throws unauthorized for missing, malformed, or mismatched tokens", () => {
    expect(() => enforceBearerAuth({ token: "secret" }, request())).toThrow(ClientError);
    expect(() => enforceBearerAuth({ token: "secret" }, request("Basic secret"))).toThrow(ClientError);
    expect(() => enforceBearerAuth({ token: "secret" }, request("Bearer nope"))).toThrow(
      expect.objectContaining({ code: "unauthorized", statusCode: 401 })
    );
    expect(() => enforceBearerAuth({ token: "secret" }, request("Bearer secrit"))).toThrow(
      expect.objectContaining({ code: "unauthorized", statusCode: 401 })
    );
  });

  it("returns when bearer token matches", () => {
    expect(() => enforceBearerAuth({ token: "secret" }, request("Bearer secret"))).not.toThrow();
  });

  it("logs only when bearer auth is disabled", () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);

    warnIfBearerAuthDisabled("", logger);
    warnIfBearerAuthDisabled("secret", logger);

    expect(logs).toEqual([{ level: "warn", value: {}, message: "Adapter bearer auth is disabled." }]);
  });
});

function request(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as FastifyRequest;
}
