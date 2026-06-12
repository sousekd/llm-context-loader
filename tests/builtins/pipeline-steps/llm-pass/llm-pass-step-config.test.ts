/** Verifies llm-pass step configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseLlmPassStepConfig } from "../../../../src/builtins/pipeline-steps/llm-pass/llm-pass-step-config.js";

const baseConfig = {
  provider: "llm-default",
  templates: { system: "system", user: "user" }
};

describe("parseLlmPassStepConfig", () => {
  it("coerces numeric strings", () => {
    expect(
      parseLlmPassStepConfig({
        ...baseConfig,
        minInputChars: "100",
        maxInputChars: "1000",
        outputReserveRatio: "0.5",
        outputReserveChars: "25000"
      })
    ).toMatchObject({ minInputChars: 100, maxInputChars: 1000, outputReserveRatio: 0.5, outputReserveChars: 25000 });
  });

  it("treats blank optional numerics as omitted", () => {
    const config = parseLlmPassStepConfig({
      ...baseConfig,
      minInputChars: "",
      maxInputChars: "",
      outputReserveRatio: "",
      outputReserveChars: ""
    });

    expect(config.minInputChars).toBeUndefined();
    expect(config.maxInputChars).toBeUndefined();
    expect(config.outputReserveRatio).toBeUndefined();
    expect(config.outputReserveChars).toBeUndefined();
  });

  it("rejects invalid numeric fields", () => {
    expect(() => parseLlmPassStepConfig({ ...baseConfig, maxInputChars: "0" })).toThrow();
    expect(() => parseLlmPassStepConfig({ ...baseConfig, outputReserveRatio: "abc" })).toThrow();
  });
});
