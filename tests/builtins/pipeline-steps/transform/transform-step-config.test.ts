/** Verifies the transform pipeline step config parsing. */
import { describe, expect, it } from "vitest";

import { parseTransformStepConfig } from "../../../../src/builtins/pipeline-steps/transform/transform-step-config.js";

describe("parseTransformStepConfig", () => {
  it("applies defaults for optional fields", () => {
    expect(parseTransformStepConfig({ transformer: "mdream-convert", target: "text/markdown" })).toEqual({
      transformer: "mdream-convert",
      target: "text/markdown",
      onUnsupported: "skip",
      onDeclined: "skip",
      emitDiagnostics: false
    });
  });

  it("requires transformer and target", () => {
    expect(() => parseTransformStepConfig({ target: "text/markdown" })).toThrow();
    expect(() => parseTransformStepConfig({ transformer: "x" })).toThrow();
  });

  it("validates the onUnsupported and onDeclined enums and coerces emitDiagnostics", () => {
    expect(() =>
      parseTransformStepConfig({ transformer: "x", target: "text/markdown", onUnsupported: "explode" })
    ).toThrow();
    expect(() =>
      parseTransformStepConfig({ transformer: "x", target: "text/markdown", onDeclined: "explode" })
    ).toThrow();
    expect(
      parseTransformStepConfig({ transformer: "x", target: "text/markdown", emitDiagnostics: "true" }).emitDiagnostics
    ).toBe(true);
  });

  it("parses explicit onDeclined values", () => {
    expect(parseTransformStepConfig({ transformer: "x", target: "text/markdown", onDeclined: "fail" }).onDeclined).toBe(
      "fail"
    );
    expect(parseTransformStepConfig({ transformer: "x", target: "text/markdown", onDeclined: "skip" }).onDeclined).toBe(
      "skip"
    );
  });

  it("rejects unknown keys", () => {
    expect(() => parseTransformStepConfig({ transformer: "x", target: "text/markdown", extra: 1 })).toThrow();
  });
});
