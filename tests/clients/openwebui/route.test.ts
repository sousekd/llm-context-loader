import { describe, expect, it } from "vitest";

import type { AppConfig } from "../../../src/config/config.js";

import { openWebUiPlugin } from "../../../src/clients/openwebui/route.js";
import { buildTestApp, makeUseCaseStub } from "../../helpers/index.js";

async function buildApp(config: Partial<AppConfig>) {
  const { useCase, calls } = makeUseCaseStub();
  const app = await buildTestApp(openWebUiPlugin, { config: config as AppConfig, useCase });
  return { app, calls };
}

describe("openWebUiPlugin", () => {
  it("returns OpenWebUI documents for a valid batch", async () => {
    const { app, calls } = await buildApp({ AUTH_ENABLED: false, API_KEY: "" });
    const urls = ["https://example.com/a", "https://example.com/b"];

    try {
      const response = await app.inject({ method: "POST", url: "/", payload: { urls } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        expect.objectContaining({ page_content: "MD for https://example.com/a" }),
        expect.objectContaining({ page_content: "MD for https://example.com/b" })
      ]);
      expect(calls.loadMany).toEqual([urls]);
    } finally {
      await app.close();
    }
  });

  it("accepts a 20 URL batch", async () => {
    const { app } = await buildApp({ AUTH_ENABLED: false, API_KEY: "" });
    const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}`);

    try {
      const response = await app.inject({ method: "POST", url: "/", payload: { urls } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(20);
    } finally {
      await app.close();
    }
  });

  it("returns validation_error for a 21 URL batch", async () => {
    const { app } = await buildApp({ AUTH_ENABLED: false, API_KEY: "" });
    const urls = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`);

    try {
      const response = await app.inject({ method: "POST", url: "/", payload: { urls } });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "validation_error" });
    } finally {
      await app.close();
    }
  });

  it("returns validation_error for an empty batch", async () => {
    const { app } = await buildApp({ AUTH_ENABLED: false, API_KEY: "" });

    try {
      const response = await app.inject({ method: "POST", url: "/", payload: { urls: [] } });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "validation_error" });
    } finally {
      await app.close();
    }
  });

  it("returns unauthorized when authentication is enabled and bearer is missing", async () => {
    const { app } = await buildApp({ AUTH_ENABLED: true, API_KEY: "secret" });

    try {
      const response = await app.inject({ method: "POST", url: "/", payload: { urls: ["https://example.com"] } });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("returns documents when authentication is enabled and bearer matches", async () => {
    const { app } = await buildApp({ AUTH_ENABLED: true, API_KEY: "secret" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/",
        headers: { authorization: "Bearer secret" },
        payload: { urls: ["https://example.com"] }
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
