/** Verifies capture-urls step descriptor wiring. */
import { describe, expect, it } from "vitest";

import { captureUrlsStepDescriptor } from "../../../../src/builtins/pipeline-steps/capture-urls/capture-urls-step-descriptor.js";
import { createExtensionServicesBuilder } from "../../../../src/engine/internal/extension-services.js";
import {
  assertPipelineStepIdentity,
  assertPipelineStepRunsCleanly
} from "../../../contracts/pipeline-step-conformance.js";
import { createTestHostTools } from "../../../helpers/host-tools.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("captureUrlsStepDescriptor", () => {
  it("exposes the expected type and parses config", () => {
    expect(captureUrlsStepDescriptor.type).toBe("capture-urls");
    expect(captureUrlsStepDescriptor.parseConfig({})).toEqual({ artifact: "trusted-urls" });
  });

  it("constructs a runnable pipeline step", async () => {
    const step = await captureUrlsStepDescriptor.create({
      name: "capture",
      type: "capture-urls",
      timeoutSeconds: 5,
      config: { artifact: "trusted-urls" },
      services: createExtensionServicesBuilder().build(),
      deps: { logger: createTestLogger(), tools: createTestHostTools() }
    });

    assertPipelineStepIdentity(step);
    await assertPipelineStepRunsCleanly(step, makeStepContext({ body: { content: "[x](https://example.com/x)" } }));
  });
});
