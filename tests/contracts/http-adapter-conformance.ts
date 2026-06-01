/** Provides shared behavioral conformance tests for HTTP adapters. */
import { describe, expect, it, vi } from "vitest";

import { buildTestHttpApp } from "../helpers/app.js";
import { makePipelineResult, makeStaticPipelineHandle } from "../helpers/pipeline.js";

import type { LightMyRequestResponse } from "fastify";
import type { HttpAdapter } from "../../src/adapters/http/adapter-contracts.js";
import type { PipelineHandle } from "../../src/contracts/pipeline/handle.js";

export interface HttpAdapterConformanceSpec {
  readonly name: string;
  createAdapter(args: { readonly bearerToken: string; readonly handle: PipelineHandle }): HttpAdapter;
  invokeBatch(
    app: Awaited<ReturnType<typeof buildTestHttpApp>>,
    args: { readonly urls: ReadonlyArray<string>; readonly bearerToken: string }
  ): Promise<LightMyRequestResponse>;
  invokeWithoutAuth(
    app: Awaited<ReturnType<typeof buildTestHttpApp>>,
    args: { readonly urls: ReadonlyArray<string> }
  ): Promise<LightMyRequestResponse>;
  readonly failureCase?: {
    readonly url: string;
  };
}

export function runHttpAdapterConformance(spec: HttpAdapterConformanceSpec): void {
  describe(`HttpAdapter conformance: ${spec.name}`, () => {
    it("registers without throwing on a Fastify instance", async () => {
      const { handle } = makeStaticPipelineHandle(makePipelineResult("hello"));
      const adapter = spec.createAdapter({ bearerToken: "", handle });
      const app = await buildTestHttpApp({ httpAdapters: [adapter] });
      await app.close();
    });

    it("invokes the pipeline handle once per URL on success", async () => {
      const { handle, inputs } = makeStaticPipelineHandle(makePipelineResult("hello"));
      const adapter = spec.createAdapter({ bearerToken: "", handle });
      const app = await buildTestHttpApp({ httpAdapters: [adapter] });

      const response = await spec.invokeBatch(app, { urls: ["https://example.com/"], bearerToken: "" });

      expect(response.statusCode).toBe(200);
      expect(inputs).toEqual(["https://example.com/"]);
      await app.close();
    });

    it("rejects requests without the configured bearer token", async () => {
      const { handle } = makeStaticPipelineHandle(makePipelineResult("hello"));
      const adapter = spec.createAdapter({ bearerToken: "secret", handle });
      const app = await buildTestHttpApp({ httpAdapters: [adapter] });

      const rejected = await spec.invokeWithoutAuth(app, { urls: ["https://example.com/"] });
      const accepted = await spec.invokeBatch(app, { urls: ["https://example.com/"], bearerToken: "secret" });

      expect(rejected.statusCode).toBe(401);
      expect(accepted.statusCode).toBe(200);
      await app.close();
    });

    if (spec.failureCase) {
      const failureCase = spec.failureCase;
      it("routes per-URL failures through handle.renderFailure", async () => {
        const { handle } = makeStaticPipelineHandle(makePipelineResult("hello"));
        const renderFailureSpy = vi.spyOn(handle, "renderFailure");
        const adapter = spec.createAdapter({ bearerToken: "", handle });
        const app = await buildTestHttpApp({ httpAdapters: [adapter] });

        const response = await spec.invokeBatch(app, { urls: [failureCase.url], bearerToken: "" });

        expect(response.statusCode).toBe(200);
        expect(renderFailureSpy).toHaveBeenCalledTimes(1);
        await app.close();
      });
    }
  });
}
