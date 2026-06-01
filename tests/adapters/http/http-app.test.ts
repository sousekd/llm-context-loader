/** Verifies shared HTTP host request, logging, and error behavior. */
import { describe, expect, it } from "vitest";

import type { HttpAdapter } from "../../../src/adapters/http/adapter-contracts.js";
import { ClientError, InternalError } from "../../../src/shared/errors.js";
import { getRequestContext } from "../../../src/shared/request-context.js";
import { buildTestHttpApp } from "../../helpers/app.js";
import { createTestLogger, type CapturedLog } from "../../helpers/logger.js";

describe("buildHttpApp", () => {
  it("serves health without adapters", async () => {
    const app = await buildTestHttpApp({ httpAdapters: [] });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "llm-context-loader" });
    await app.close();
  });

  it("logs a single HTTP request finished line for non-health requests", async () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);
    const okAdapter: HttpAdapter = {
      register(server) {
        server.get("/ok", async () => ({ ok: true }));
      }
    };

    const app = await buildTestHttpApp({ httpAdapters: [okAdapter], logger });
    const response = await app.inject({ method: "GET", url: "/ok" });

    expect(response.statusCode).toBe(200);
    const httpLogs = logs.filter(log => log.message === "HTTP request finished.");
    expect(httpLogs).toHaveLength(1);
    expect(httpLogs[0]?.level).toBe("info");
    expect(httpLogs[0]?.value).toMatchObject({ method: "GET", url: "/ok", status_code: 200 });
    expect((httpLogs[0]?.value as { duration_ms?: number }).duration_ms).toEqual(expect.any(Number));
    await app.close();
  });

  it("does not log HTTP request finished for /health", async () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);
    const app = await buildTestHttpApp({ httpAdapters: [], logger });

    await app.inject({ method: "GET", url: "/health" });

    expect(logs.find(log => log.message === "HTTP request finished.")).toBeUndefined();
    await app.close();
  });

  it("enters request context with the inbound request ID", async () => {
    const contextAdapter: HttpAdapter = {
      register(server) {
        server.get("/context", async () => getRequestContext());
      }
    };
    const app = await buildTestHttpApp({ httpAdapters: [contextAdapter] });

    const response = await app.inject({ method: "GET", url: "/context", headers: { "x-request-id": "request-1" } });

    expect(response.json()).toEqual({ request_id: "request-1" });
    await app.close();
  });

  it("logs a warn line and 4xx response for ClientError", async () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);
    const errAdapter: HttpAdapter = {
      register(server) {
        server.get("/boom", async () => {
          throw new ClientError("nope", "bad_request", 418);
        });
      }
    };

    const app = await buildTestHttpApp({ httpAdapters: [errAdapter], logger });
    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(418);
    const warnLogs = logs.filter(log => log.message === "HTTP client error.");
    expect(warnLogs).toHaveLength(1);
    expect(warnLogs[0]?.level).toBe("warn");
    expect(warnLogs[0]?.value).toMatchObject({
      method: "GET",
      url: "/boom",
      status_code: 418,
      code: "bad_request"
    });
    await app.close();
  });

  it("logs an error line and opaque 500 response for InternalError", async () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);
    const errAdapter: HttpAdapter = {
      register(server) {
        server.get("/boom", async () => {
          throw new InternalError("secret details", "internal_secret");
        });
      }
    };

    const app = await buildTestHttpApp({ httpAdapters: [errAdapter], logger });
    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "internal_secret", message: "Internal server error" });
    expect(response.body).not.toContain("secret details");
    const errorLogs = logs.filter(log => log.message === "Unhandled request error.");
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0]?.level).toBe("error");
    await app.close();
  });

  it("wraps unknown request errors with a stable InternalError and preserved cause", async () => {
    const logs: CapturedLog[] = [];
    const logger = createTestLogger(logs);
    const cause = new Error("secret details");
    const errAdapter: HttpAdapter = {
      register(server) {
        server.get("/boom", async () => {
          throw cause;
        });
      }
    };

    const app = await buildTestHttpApp({ httpAdapters: [errAdapter], logger });
    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "unhandled_request_error", message: "Internal server error" });
    expect(response.body).not.toContain("secret details");
    const errorLogs = logs.filter(log => log.message === "Unhandled request error.");
    expect(errorLogs).toHaveLength(1);
    const internal = (errorLogs[0]?.value as { err?: unknown }).err;
    expect(internal).toBeInstanceOf(InternalError);
    expect(internal).toMatchObject({ code: "unhandled_request_error" });
    expect((internal as InternalError).cause).toBe(cause);
    await app.close();
  });
});
