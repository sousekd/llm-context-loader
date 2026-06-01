/** Verifies capture-urls step configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseCaptureUrlsStepConfig } from "../../../../src/builtins/pipeline-steps/capture-urls/capture-urls-step-config.js";

describe("parseCaptureUrlsStepConfig", () => {
  it("applies the default artifact key when omitted", () => {
    expect(parseCaptureUrlsStepConfig({})).toEqual({ artifact: "trusted-urls" });
  });

  it("accepts a custom artifact key", () => {
    expect(parseCaptureUrlsStepConfig({ artifact: "source-urls" })).toEqual({ artifact: "source-urls" });
  });

  it("rejects unknown keys and empty artifact values", () => {
    expect(() => parseCaptureUrlsStepConfig({ unknown: true })).toThrow();
    expect(() => parseCaptureUrlsStepConfig({ artifact: "" })).toThrow();
  });
});
