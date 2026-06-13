/** Verifies the classify-url pipeline step runtime behavior. */
import { describe, expect, it } from "vitest";

import { ClassifyUrlStep } from "../../../../src/builtins/pipeline-steps/classify-url/classify-url-step.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

import type { UrlClassifyRule } from "../../../../src/builtins/pipeline-steps/classify-url/classify-url-step-config.js";

describe("ClassifyUrlStep", () => {
  it("emits no signals when no rules match", async () => {
    const step = makeStep([{ signal: "binary_doc", match: () => false }]);

    const result = await step.run(makeStepContext());

    expect(result.status).toBe("ok");
    expect(result.effects).toBeUndefined();
    expect(result.diagnostics?.attributes?.matched).toBe("none");
  });

  it("emits a signal on match", async () => {
    const step = makeStep([{ signal: "binary_doc", match: () => true }]);

    const result = await step.run(makeStepContext());

    expect(result.status).toBe("ok");
    expect(result.effects?.signals).toEqual({ binary_doc: true });
    expect(result.diagnostics?.attributes?.matched).toBe("binary_doc");
  });

  it("emits multiple signals when multiple rules match", async () => {
    const step = makeStep([
      { signal: "binary_doc", match: () => true },
      { signal: "code_host", match: () => true }
    ]);

    const result = await step.run(makeStepContext());

    expect(result.effects?.signals).toEqual({ binary_doc: true, code_host: true });
    expect(result.diagnostics?.attributes?.matched).toContain("binary_doc");
    expect(result.diagnostics?.attributes?.matched).toContain("code_host");
  });

  it("deduplicates same signal across multiple matching rules", async () => {
    const step = makeStep([
      { signal: "binary_doc", match: () => true },
      { signal: "binary_doc", match: () => true }
    ]);

    const result = await step.run(makeStepContext());

    expect(result.effects?.signals).toEqual({ binary_doc: true });
  });

  it("emits no effects when rules array is empty", async () => {
    const step = makeStep([]);

    const result = await step.run(makeStepContext());

    expect(result.status).toBe("ok");
    expect(result.effects).toBeUndefined();
  });
});

function makeStep(rules: ReadonlyArray<UrlClassifyRule>): ClassifyUrlStep {
  return new ClassifyUrlStep({ rules }, { logger: createTestLogger() });
}
