import type { FastifyRequest } from "fastify";

import { describe, expect, it } from "vitest";

import { enforceBearerAuth } from "../../src/clients/auth.js";
import { AppError } from "../../src/core/util/errors.js";
import { buildTestConfig } from "../helpers/index.js";

function makeRequest(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as FastifyRequest;
}

describe("enforceBearerAuth", () => {
  it("returns when authentication is disabled", () => {
    const config = buildTestConfig({ AUTH_ENABLED: "false" });

    expect(() => enforceBearerAuth(config, makeRequest())).not.toThrow();
  });

  it("throws unauthorized when the bearer header is missing", () => {
    const config = buildTestConfig({ AUTH_ENABLED: "true", API_KEY: "secret" });

    expect(() => enforceBearerAuth(config, makeRequest())).toThrow(AppError);
    expect(() => enforceBearerAuth(config, makeRequest())).toThrow("Authentication required");
  });

  it("throws unauthorized when the bearer token has a different length", () => {
    const config = buildTestConfig({ AUTH_ENABLED: "true", API_KEY: "secret" });

    expect(() => enforceBearerAuth(config, makeRequest("Bearer nope"))).toThrow(
      expect.objectContaining({ code: "unauthorized", statusCode: 401 })
    );
  });

  it("throws unauthorized when the bearer token has the same length but different bytes", () => {
    const config = buildTestConfig({ AUTH_ENABLED: "true", API_KEY: "secret" });

    expect(() => enforceBearerAuth(config, makeRequest("Bearer secrit"))).toThrow(
      expect.objectContaining({ code: "unauthorized", statusCode: 401 })
    );
  });

  it("returns when the bearer token matches", () => {
    const config = buildTestConfig({ AUTH_ENABLED: "true", API_KEY: "secret" });

    expect(() => enforceBearerAuth(config, makeRequest("Bearer secret"))).not.toThrow();
  });
});
