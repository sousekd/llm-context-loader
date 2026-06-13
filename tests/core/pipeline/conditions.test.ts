/** Verifies Condition evaluation and gate resolution. */
import { describe, expect, it } from "vitest";

import { evaluateCondition, isTruthySignal, resolveStepGate } from "../../../src/core/pipeline/conditions.js";

describe("isTruthySignal", () => {
  it("returns false for undefined", () => {
    expect(isTruthySignal(undefined)).toBe(false);
  });

  it("returns false for false", () => {
    expect(isTruthySignal(false)).toBe(false);
  });

  it("returns false for 0", () => {
    expect(isTruthySignal(0)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTruthySignal("")).toBe(false);
  });

  it("returns true for boolean true", () => {
    expect(isTruthySignal(true)).toBe(true);
  });

  it("returns true for a non-empty string", () => {
    expect(isTruthySignal("matched")).toBe(true);
  });

  it("returns true for a non-zero number", () => {
    expect(isTruthySignal(1)).toBe(true);
  });
});

describe("evaluateCondition", () => {
  const lookup = (name: string) => ({ binary_doc: true, code_host: true, pdf: "yes", flag_off: false })[name];

  it("returns true when a signal exists and is truthy", () => {
    expect(evaluateCondition("binary_doc", lookup)).toBe(true);
  });

  it("returns false when a signal is missing", () => {
    expect(evaluateCondition("missing_signal", lookup)).toBe(false);
  });

  it("returns false when a signal exists but is falsy", () => {
    expect(evaluateCondition("flag_off", lookup)).toBe(false);
  });

  it("accepts a non-boolean truthy signal", () => {
    expect(evaluateCondition("pdf", lookup)).toBe(true);
  });

  it("evaluates all: empty array as true", () => {
    expect(evaluateCondition({ all: [] }, lookup)).toBe(true);
  });

  it("evaluates all: all truthy as true", () => {
    expect(evaluateCondition({ all: ["binary_doc", "code_host"] }, lookup)).toBe(true);
  });

  it("evaluates all: one falsy as false", () => {
    expect(evaluateCondition({ all: ["binary_doc", "missing_signal"] }, lookup)).toBe(false);
  });

  it("evaluates any: empty array as false", () => {
    expect(evaluateCondition({ any: [] }, lookup)).toBe(false);
  });

  it("evaluates any: one truthy as true", () => {
    expect(evaluateCondition({ any: ["binary_doc", "missing_signal"] }, lookup)).toBe(true);
  });

  it("evaluates any: all falsy as false", () => {
    expect(evaluateCondition({ any: ["missing_signal", "flag_off"] }, lookup)).toBe(false);
  });

  it("evaluates not: inverts true", () => {
    expect(evaluateCondition({ not: "binary_doc" }, lookup)).toBe(false);
  });

  it("evaluates not: inverts false", () => {
    expect(evaluateCondition({ not: "missing_signal" }, lookup)).toBe(true);
  });

  it("evaluates deeply nested conditions", () => {
    const cond = { any: [{ all: ["binary_doc", "code_host"] }, { not: "missing_signal" }] };
    expect(evaluateCondition(cond, lookup)).toBe(true);
  });
});

describe("resolveStepGate", () => {
  const lookup = (name: string) => ({ binary_doc: true, code_host: true })[name];

  it("returns undefined when no gate is set", () => {
    expect(resolveStepGate({}, lookup)).toBeUndefined();
  });

  it("returns undefined when runIf matches", () => {
    expect(resolveStepGate({ runIf: "binary_doc" }, lookup)).toBeUndefined();
  });

  it("returns run_if_unmet when runIf does not match", () => {
    expect(resolveStepGate({ runIf: "missing" }, lookup)).toBe("run_if_unmet");
  });

  it("returns undefined when skipIf does not match", () => {
    expect(resolveStepGate({ skipIf: "missing" }, lookup)).toBeUndefined();
  });

  it("returns skip_if_met when skipIf matches", () => {
    expect(resolveStepGate({ skipIf: "code_host" }, lookup)).toBe("skip_if_met");
  });

  it("prefers runIf over skipIf when both are present", () => {
    expect(resolveStepGate({ runIf: "missing", skipIf: "code_host" }, lookup)).toBe("run_if_unmet");
  });
});
