/** Verifies the Open WebUI HTTP adapter route behavior. */
import { describe, expect, it } from "vitest";

import { OpenWebUiAdapter } from "../../../../../src/adapters/http/builtins/open-webui/open-webui-adapter.js";
import { InternalError } from "../../../../../src/shared/errors.js";
import { buildTestHttpApp } from "../../../../helpers/app.js";
import { createTestLogger, type CapturedLog } from "../../../../helpers/logger.js";
import {
  makeFailedPipelineResult,
  makePipelineResult,
  makeStaticPipelineHandle
} from "../../../../helpers/pipeline.js";

describe("OpenWebUiAdapter", () => {
  it("returns Open WebUI documents with metadata and footer", async () => {
    const { handle, inputs } = makeStaticPipelineHandle(makePipelineResult("hello"));
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 20, auth: { bearerToken: "" } },
          { pipeline: handle, logger: createTestLogger() }
        )
      ]
    });

    const response = await app.inject({ method: "POST", url: "/", payload: { urls: ["https://example.com"] } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ page_content: string; metadata: { source: string; title?: string } }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.page_content).toContain("<loader_info");
    expect(body[0]?.metadata).toEqual({ source: "https://example.com", title: "Test title" });
    expect(inputs).toEqual(["https://example.com/"]);
    await app.close();
  });

  it("enforces per-adapter bearer auth", async () => {
    const { handle } = makeStaticPipelineHandle(makePipelineResult("hello"));
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 20, auth: { bearerToken: "secret" } },
          { pipeline: handle, logger: createTestLogger() }
        )
      ]
    });

    const rejected = await app.inject({ method: "POST", url: "/", payload: { urls: ["https://example.com"] } });
    const accepted = await app.inject({
      method: "POST",
      url: "/",
      headers: { authorization: "Bearer secret" },
      payload: { urls: ["https://example.com"] }
    });

    expect(rejected.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(200);
    await app.close();
  });

  it("rejects invalid request body and over-limit batches", async () => {
    const { handle, inputs } = makeStaticPipelineHandle(makePipelineResult("hello"));
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 1, auth: { bearerToken: "" } },
          { pipeline: handle, logger: createTestLogger() }
        )
      ]
    });

    const invalidBody = await app.inject({ method: "POST", url: "/", payload: { url: "https://example.com" } });
    const tooMany = await app.inject({
      method: "POST",
      url: "/",
      payload: { urls: ["https://a.example", "https://b.example"] }
    });

    expect(invalidBody.statusCode).toBe(400);
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json()).toMatchObject({ error: "too_many_urls" });
    expect(inputs).toEqual([]);
    await app.close();
  });

  it("isolates per-URL failures into diagnostic documents", async () => {
    const { handle, inputs } = makeStaticPipelineHandle(makePipelineResult("hello"));
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 5, auth: { bearerToken: "" } },
          { pipeline: handle, logger: createTestLogger() }
        )
      ]
    });

    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: { urls: ["ftp://example.com", "https://example.com"] }
    });

    expect(response.statusCode).toBe(200);
    const documents = response.json() as Array<{ page_content: string; metadata: { source: string } }>;
    expect(documents).toHaveLength(2);
    expect(documents[0]?.metadata.source).toBe("ftp://example.com");
    expect(documents[0]?.page_content).toContain("invalid_url");
    expect(documents[1]?.metadata.source).toBe("https://example.com");
    expect(inputs).toEqual(["https://example.com/"]);
    await app.close();
  });

  it("reports pipeline-rendered failures as failed outcomes while returning documents", async () => {
    const logs: CapturedLog[] = [];
    const { handle, inputs } = makeStaticPipelineHandle(makeFailedPipelineResult());
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 5, auth: { bearerToken: "" } },
          { pipeline: handle, logger: createTestLogger(logs) }
        )
      ]
    });

    const response = await app.inject({ method: "POST", url: "/", payload: { urls: ["https://example.com"] } });

    expect(response.statusCode).toBe(200);
    const documents = response.json() as Array<{ page_content: string; metadata: { source: string; title?: string } }>;
    expect(documents).toHaveLength(1);
    expect(documents[0]?.page_content).toContain('result="failed"');
    expect(documents[0]?.page_content).toContain('error="firecrawl: scrape_retry_limit"');
    expect(documents[0]?.metadata).toEqual({ source: "https://example.com" });
    expect(inputs).toEqual(["https://example.com/"]);
    expect(logs.find(log => log.message === "Open WebUI batch finished.")?.value).toMatchObject({
      ok_count: 0,
      degraded_count: 0,
      failed_count: 1
    });
    await app.close();
  });

  it("does not isolate internal pipeline failures as per-URL diagnostics", async () => {
    const app = await buildTestHttpApp({
      httpAdapters: [
        new OpenWebUiAdapter(
          { path: "/", maxUrls: 5, auth: { bearerToken: "" } },
          {
            pipeline: {
              run: async () => {
                throw new InternalError("renderer exploded", "renderer_failed");
              },
              renderFailure: async () => "should not render"
            },
            logger: createTestLogger()
          }
        )
      ]
    });

    const response = await app.inject({ method: "POST", url: "/", payload: { urls: ["https://example.com"] } });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("should not render");
    await app.close();
  });
});
