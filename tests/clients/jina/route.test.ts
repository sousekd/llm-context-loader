import { describe, expect, it } from "vitest";

import type { AppConfig } from "../../../src/config/config.js";
import type { LoadContextUseCase } from "../../../src/core/use-cases/load-context.js";

import { jinaPlugin } from "../../../src/clients/jina/route.js";
import { buildTestApp, makeUseCaseStub } from "../../helpers/index.js";

async function buildApp(config: Partial<AppConfig>, useCase: LoadContextUseCase) {
  return buildTestApp(jinaPlugin, { config: config as AppConfig, useCase });
}

function makeStub() {
  return makeUseCaseStub({ forbidLoadMany: true });
}

describe("jinaPlugin", () => {
  it("returns markdown for path-style URLs", async () => {
    const { useCase, calls } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: false, API_KEY: "" }, useCase);

    try {
      const response = await app.inject({ method: "GET", url: "/r/https://example.com/article" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/markdown");
      expect(response.body).toBe("MD for https://example.com/article");
      expect(calls.loadOne).toEqual(["https://example.com/article"]);
    } finally {
      await app.close();
    }
  });

  it("preserves query strings in path-style URLs", async () => {
    const { useCase, calls } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: false, API_KEY: "" }, useCase);

    try {
      const response = await app.inject({ method: "GET", url: "/r/https://example.com/article?id=42&tag=ai" });

      expect(response.statusCode).toBe(200);
      expect(calls.loadOne).toEqual(["https://example.com/article?id=42&tag=ai"]);
    } finally {
      await app.close();
    }
  });

  it("returns markdown for query-style URLs", async () => {
    const { useCase, calls } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: false, API_KEY: "" }, useCase);

    try {
      const response = await app.inject({ method: "GET", url: "/r?url=https%3A%2F%2Fexample.com%2Fp" });

      expect(response.statusCode).toBe(200);
      expect(calls.loadOne).toEqual(["https://example.com/p"]);
    } finally {
      await app.close();
    }
  });

  it("returns validation_error when query-style URL is missing", async () => {
    const { useCase } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: false, API_KEY: "" }, useCase);

    try {
      const response = await app.inject({ method: "GET", url: "/r" });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "validation_error" });
    } finally {
      await app.close();
    }
  });

  it("returns unauthorized when authentication is enabled and the bearer is missing", async () => {
    const { useCase } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: true, API_KEY: "secret" }, useCase);

    try {
      const response = await app.inject({ method: "GET", url: "/r/https://example.com" });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("returns markdown when authentication is enabled and the bearer matches", async () => {
    const { useCase } = makeStub();
    const app = await buildApp({ AUTH_ENABLED: true, API_KEY: "secret" }, useCase);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/r/https://example.com",
        headers: { authorization: "Bearer secret" }
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
