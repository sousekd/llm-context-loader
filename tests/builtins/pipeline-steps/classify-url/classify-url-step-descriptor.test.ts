/** Verifies the classify-url step descriptor shape and bundle registration. */
import { describe, expect, it } from "vitest";

import { classifyUrlStepDescriptor } from "../../../../src/builtins/pipeline-steps/classify-url/classify-url-step-descriptor.js";
import { DEFAULT_ENGINE_DESCRIPTOR_BUNDLE } from "../../../../src/bundles/default-engine-descriptors.js";

import type { PipelineStepDescriptor } from "../../../../src/contracts/pipeline/step.js";

describe("classifyUrlStepDescriptor", () => {
  it("has type classify-url", () => {
    expect(classifyUrlStepDescriptor.type).toBe("classify-url");
  });

  it("creates a ClassifyUrlStep", async () => {
    const step = await classifyUrlStepDescriptor.create({
      name: "classify",
      type: "classify-url",
      timeoutSeconds: 30,
      config: classifyUrlStepDescriptor.parseConfig({ rules: [] }),
      deps: { tools: {} as never, logger: {} as never },
      services: {} as never
    });

    expect(step.constructor.name).toBe("ClassifyUrlStep");
  });

  it("is registered in the default engine descriptor bundle", () => {
    const descriptor = DEFAULT_ENGINE_DESCRIPTOR_BUNDLE.pipelineSteps["classify-url"];
    expect(descriptor).toBeDefined();
    expect(descriptor?.type).toBe("classify-url");
  });
});
