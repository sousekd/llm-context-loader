/** Verifies the transform pipeline step config parsing. */
import { describe, expect, it } from "vitest";

import { parseTransformStepConfig } from "../../../../src/builtins/pipeline-steps/transform/transform-step-config.js";

describe("parseTransformStepConfig", () => {
  it("applies defaults for optional fields", () => {
    expect(parseTransformStepConfig({ transformer: "mdream-default", target: "text/markdown" })).toEqual({
      transformer: "mdream-default",
      target: "text/markdown",
      onUnsupported: "skip",
      emitDiagnostics: false
    });
  });

  it("requires transformer and target", () => {
    expect(() => parseTransformStepConfig({ target: "text/markdown" })).toThrow();
    expect(() => parseTransformStepConfig({ transformer: "x" })).toThrow();
  });

  it("validates the onUnsupported enum and coerces emitDiagnostics", () => {
    expect(() =>
      parseTransformStepConfig({ transformer: "x", target: "text/markdown", onUnsupported: "explode" })
    ).toThrow();
    expect(
      parseTransformStepConfig({ transformer: "x", target: "text/markdown", emitDiagnostics: "true" }).emitDiagnostics
    ).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(() => parseTransformStepConfig({ transformer: "x", target: "text/markdown", extra: 1 })).toThrow();
  });
});
