/** Verifies truncate step configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseTruncateStepConfig } from "../../../../src/builtins/pipeline-steps/truncate/truncate-step-config.js";

describe("parseTruncateStepConfig", () => {
  it("defaults and coerces targetChars without accepting blanks as zero", () => {
    expect(parseTruncateStepConfig({})).toEqual({ targetChars: 25_000 });
    expect(parseTruncateStepConfig({ targetChars: "5000" })).toEqual({ targetChars: 5000 });
    expect(parseTruncateStepConfig({ targetChars: "" })).toEqual({ targetChars: 25_000 });
  });

  it("rejects invalid targetChars values", () => {
    expect(() => parseTruncateStepConfig({ targetChars: -1 })).toThrow();
    expect(() => parseTruncateStepConfig({ targetChars: "abc" })).toThrow();
  });
});
