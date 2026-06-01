/** Verifies the capture-urls pipeline step behavior. */
import { describe, expect, it } from "vitest";

import { CaptureUrlsStep } from "../../../../src/builtins/pipeline-steps/capture-urls/capture-urls-step.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("CaptureUrlsStep", () => {
  it("skips when no body is present", async () => {
    const step = new CaptureUrlsStep({ artifact: "trusted-urls" }, { logger: createTestLogger() });

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "skipped", reason: "no_body" });
  });

  it("captures canonical URLs from the current body into the configured artifact", async () => {
    const step = new CaptureUrlsStep({ artifact: "trusted-urls" }, { logger: createTestLogger() });
    const markdown = ["See [docs](https://example.com/docs).", "Also https://example.com/other"].join("\n");

    const result = await step.run(makeStepContext({ body: { content: markdown } }));

    expect(result.status).toBe("ok");
    expect(result.diagnostics?.attributes).toEqual({ artifact: "trusted-urls", url_count: 2 });
    const stored = result.effects?.artifacts?.["trusted-urls"] as Set<string>;
    expect(stored).toBeInstanceOf(Set);
    expect([...stored].sort()).toEqual(["https://example.com/docs", "https://example.com/other"]);
  });

  it("writes an empty set when the body has no URLs", async () => {
    const step = new CaptureUrlsStep({ artifact: "trusted-urls" }, { logger: createTestLogger() });

    const result = await step.run(makeStepContext({ body: { content: "Just prose, no links here." } }));

    expect(result.status).toBe("ok");
    expect(result.diagnostics?.attributes).toEqual({ artifact: "trusted-urls", url_count: 0 });
    expect((result.effects?.artifacts?.["trusted-urls"] as Set<string>).size).toBe(0);
  });

  it("respects a custom artifact key", async () => {
    const step = new CaptureUrlsStep({ artifact: "source-urls" }, { logger: createTestLogger() });

    const result = await step.run(makeStepContext({ body: { content: "[link](https://example.com/x)" } }));

    expect(result.effects?.artifacts).toHaveProperty("source-urls");
    expect(result.diagnostics?.attributes?.["artifact"]).toBe("source-urls");
  });
});
