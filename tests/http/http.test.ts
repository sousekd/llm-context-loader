import type { FastifyPluginAsync } from "fastify";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ClientPlugin } from "../../src/clients/registry.js";
import type { Composition } from "../../src/composition.js";

import { AppError } from "../../src/core/util/errors.js";
import { buildHttpApp } from "../../src/http.js";
import { buildTestConfig, makeUseCaseStub, silentLogger } from "../helpers/index.js";

const failingPlugin: FastifyPluginAsync = async (app) => {
  app.get("/zod", async () => z.object({ value: z.string() }).parse({}));
  app.get("/app", async () => {
    throw new AppError("No access", "denied", 403);
  });
  app.get("/unknown", async () => {
    throw new Error("boom");
  });
};

function makeComposition(clients: ClientPlugin[] = []): Composition {
  const { useCase } = makeUseCaseStub();
  return {
    config: buildTestConfig({ CLIENTS: "" }),
    logger: silentLogger(),
    useCase,
    clients
  };
}

function makeFailingClient(): ClientPlugin {
  return { kind: "http", name: "test", build: () => ({ plugin: failingPlugin, options: {} }) };
}

describe("buildHttpApp", () => {
  it("returns health status when no clients are registered", async () => {
    const app = await buildHttpApp(makeComposition(), silentLogger());

    try {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok", service: "llm-context-loader" });
    } finally {
      await app.close();
    }
  });

  it("returns validation_error for ZodError failures", async () => {
    const app = await buildHttpApp(makeComposition([makeFailingClient()]), silentLogger());

    try {
      const response = await app.inject({ method: "GET", url: "/zod" });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: "validation_error" });
    } finally {
      await app.close();
    }
  });

  it("returns AppError status and code", async () => {
    const app = await buildHttpApp(makeComposition([makeFailingClient()]), silentLogger());

    try {
      const response = await app.inject({ method: "GET", url: "/app" });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "denied", message: "No access" });
    } finally {
      await app.close();
    }
  });

  it("returns internal_error for unknown failures", async () => {
    const app = await buildHttpApp(makeComposition([makeFailingClient()]), silentLogger());

    try {
      const response = await app.inject({ method: "GET", url: "/unknown" });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "internal_error", message: "boom" });
    } finally {
      await app.close();
    }
  });
});

