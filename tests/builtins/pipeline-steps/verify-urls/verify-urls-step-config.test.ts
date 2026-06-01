/** Verifies verify-urls step configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseVerifyUrlsStepConfig } from "../../../../src/builtins/pipeline-steps/verify-urls/verify-urls-step-config.js";

describe("parseVerifyUrlsStepConfig", () => {
  it("applies defaults when fields are omitted", () => {
    expect(parseVerifyUrlsStepConfig({})).toEqual({ artifact: "trusted-urls", onHallucination: "report" });
  });

  it("accepts the rollback mode", () => {
    expect(parseVerifyUrlsStepConfig({ onHallucination: "rollback" })).toMatchObject({ onHallucination: "rollback" });
  });

  it("rejects unknown modes and unknown keys", () => {
    expect(() => parseVerifyUrlsStepConfig({ onHallucination: "ignore" })).toThrow();
    expect(() => parseVerifyUrlsStepConfig({ unknown: true })).toThrow();
    expect(() => parseVerifyUrlsStepConfig({ artifact: "" })).toThrow();
  });

  it("accepts maxReportedUrls as a non-negative integer or coerced string", () => {
    expect(parseVerifyUrlsStepConfig({ maxReportedUrls: 0 })).toMatchObject({ maxReportedUrls: 0 });
    expect(parseVerifyUrlsStepConfig({ maxReportedUrls: 50 })).toMatchObject({ maxReportedUrls: 50 });
    expect(parseVerifyUrlsStepConfig({ maxReportedUrls: "25" })).toMatchObject({ maxReportedUrls: 25 });
  });

  it("treats blank maxReportedUrls as omitted", () => {
    expect(parseVerifyUrlsStepConfig({ maxReportedUrls: "" }).maxReportedUrls).toBeUndefined();
  });

  it("rejects negative or non-integer maxReportedUrls", () => {
    expect(() => parseVerifyUrlsStepConfig({ maxReportedUrls: -1 })).toThrow();
    expect(() => parseVerifyUrlsStepConfig({ maxReportedUrls: 1.5 })).toThrow();
    expect(() => parseVerifyUrlsStepConfig({ maxReportedUrls: "abc" })).toThrow();
  });
});
