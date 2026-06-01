/** Verifies the Jina Reader-style HTTP adapter route behavior. */
import { describe, expect, it } from "vitest";

import { JinaAdapter } from "../../../../../src/adapters/http/builtins/jina/jina-adapter.js";
import { buildTestHttpApp } from "../../../../helpers/app.js";
import { createTestLogger } from "../../../../helpers/logger.js";
import {
  makeCompiledPipeline,
  makePassthroughRenderer,
  makePipelineResult,
  makeStaticPipelineHandle
} from "../../../../helpers/pipeline.js";

describe("JinaAdapter", () => {
  it("accepts path and query URL forms and returns markdown", async () => {
    const { handle, inputs } = makeStaticPipelineHandle(
      makePipelineResult("hello"),
      makeCompiledPipeline(makePassthroughRenderer())
    );
    const adapter = new JinaAdapter(
      { path: "/r", auth: { bearerToken: "" } },
      { pipeline: handle, logger: createTestLogger() }
    );
    const app = await buildTestHttpApp({ httpAdapters: [adapter] });

    const pathResponse = await app.inject({ method: "GET", url: "/r/https://example.com/path" });
    const queryResponse = await app.inject({ method: "GET", url: "/r?url=https%3A%2F%2Fexample.com%2Fquery" });
    const embeddedQueryResponse = await app.inject({
      method: "GET",
      url: "/r/https://www.youtube.com/watch?v=PHA_VW8RIic"
    });
    const encodedPathResponse = await app.inject({
      method: "GET",
      url: "/r/https%3A%2F%2Fexample.com%2Fwatch%3Fv%3Dx"
    });

    expect(pathResponse.statusCode).toBe(200);
    expect(pathResponse.headers["content-type"]).toContain("text/markdown");
    expect(pathResponse.body).toBe("hello");
    expect(queryResponse.statusCode).toBe(200);
    expect(embeddedQueryResponse.statusCode).toBe(200);
    expect(encodedPathResponse.statusCode).toBe(200);
    expect(inputs).toEqual([
      "https://example.com/path",
      "https://example.com/query",
      "https://www.youtube.com/watch?v=PHA_VW8RIic",
      "https://example.com/watch?v=x"
    ]);
    await app.close();
  });

  it("enforces auth and validates required HTTP URLs", async () => {
    const { handle, inputs } = makeStaticPipelineHandle(makePipelineResult("hello"));
    const adapter = new JinaAdapter(
      { path: "/r", auth: { bearerToken: "secret" } },
      { pipeline: handle, logger: createTestLogger() }
    );
    const app = await buildTestHttpApp({ httpAdapters: [adapter] });

    const rejected = await app.inject({ method: "GET", url: "/r/https://example.com" });
    const missing = await app.inject({ method: "GET", url: "/r", headers: { authorization: "Bearer secret" } });
    const invalid = await app.inject({
      method: "GET",
      url: "/r/ftp://example.com",
      headers: { authorization: "Bearer secret" }
    });
    const accepted = await app.inject({
      method: "GET",
      url: "/r/https://example.com",
      headers: { authorization: "Bearer secret" }
    });

    expect(rejected.statusCode).toBe(401);
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ error: "missing_url" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: "invalid_url" });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.body).toContain("<loader_info");
    expect(inputs).toEqual(["https://example.com/"]);
    await app.close();
  });
});
