/** Verifies verify-urls step descriptor wiring. */
import { describe, expect, it } from "vitest";

import { verifyUrlsStepDescriptor } from "../../../../src/builtins/pipeline-steps/verify-urls/verify-urls-step-descriptor.js";
import { createExtensionServicesBuilder } from "../../../../src/engine/internal/extension-services.js";
import {
  assertPipelineStepIdentity,
  assertPipelineStepRunsCleanly
} from "../../../contracts/pipeline-step-conformance.js";
import { createTestHostTools } from "../../../helpers/host-tools.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("verifyUrlsStepDescriptor", () => {
  it("exposes the expected type and default config", () => {
    expect(verifyUrlsStepDescriptor.type).toBe("verify-urls");
    expect(verifyUrlsStepDescriptor.parseConfig({})).toEqual({ artifact: "trusted-urls", onHallucination: "report" });
  });

  it("constructs a runnable pipeline step", async () => {
    const step = await verifyUrlsStepDescriptor.create({
      name: "verify",
      type: "verify-urls",
      timeoutSeconds: 5,
      config: { artifact: "trusted-urls", onHallucination: "report" },
      services: createExtensionServicesBuilder().build(),
      deps: { logger: createTestLogger(), tools: createTestHostTools() }
    });

    assertPipelineStepIdentity(step);
    await assertPipelineStepRunsCleanly(step, makeStepContext({ body: { content: "[x](https://example.com/x)" } }));
  });
});
