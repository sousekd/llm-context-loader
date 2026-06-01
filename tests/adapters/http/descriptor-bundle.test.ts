/** Verifies the default HTTP adapter descriptor bundle. */
import { describe, expect, it } from "vitest";

import type { PipelineHandle } from "../../../src/contracts/pipeline/handle.js";
import { DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE } from "../../../src/adapters/http/descriptor-bundle.js";
import { createTestLogger } from "../../helpers/logger.js";
import { makePipelineResult } from "../../helpers/pipeline.js";

describe("DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE", () => {
  it("contains constructible bundled HTTP adapter descriptors", async () => {
    const pipeline = pipelineHandle();
    const openWebUiConfig = DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE["open-webui"].parseConfig({
      auth: { bearerToken: "" }
    });
    const openWebUi = await DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE["open-webui"].create({
      name: "owui",
      type: "open-webui",
      config: openWebUiConfig,
      pipeline,
      deps: { logger: createTestLogger(), tools: { require: () => undefined as never, tryGet: () => undefined } }
    });
    const jinaConfig = DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE.jina.parseConfig({ auth: { bearerToken: "" } });
    const jina = await DEFAULT_HTTP_ADAPTER_DESCRIPTOR_BUNDLE.jina.create({
      name: "jina",
      type: "jina",
      config: jinaConfig,
      pipeline,
      deps: { logger: createTestLogger(), tools: { require: () => undefined as never, tryGet: () => undefined } }
    });

    expect(openWebUi).toHaveProperty("register");
    expect(jina).toHaveProperty("register");
  });
});

function pipelineHandle(): PipelineHandle {
  return {
    run: async () => ({ markdown: "ok", run: makePipelineResult("ok") }),
    renderFailure: async () => "failed"
  };
}
