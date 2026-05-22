import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { applySpanPatches } from "../../../src/tools/shared/apply-span-patches.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("applySpanPatches", () => {
  it("applies a single patch", () => {
    expect(applySpanPatches("alpha beta", [{ start: 6, end: 10, replacement: "gamma" }])).toBe("alpha gamma");
  });

  it("applies multiple patches using original offsets", () => {
    const result = applySpanPatches("a bb ccc", [
      { start: 0, end: 1, replacement: "aaa" },
      { start: 5, end: 8, replacement: "c" }
    ]);

    expect(result).toBe("aaa bb c");
  });

  it("allows adjacent patches", () => {
    const result = applySpanPatches("abcdef", [
      { start: 1, end: 3, replacement: "XX" },
      { start: 3, end: 5, replacement: "YY" }
    ]);

    expect(result).toBe("aXXYYf");
  });

  it("returns the original string when no patches are supplied", () => {
    expect(applySpanPatches("alpha", [])).toBe("alpha");
  });

  it("preserves bytes outside patched spans", () => {
    const source = "prefix https://bad.example/path suffix";
    const result = applySpanPatches(source, [{ start: 7, end: 31, replacement: "https://good.example/path" }]);

    expect(hash(result.slice(0, 7))).toBe(hash(source.slice(0, 7)));
    expect(hash(result.slice(-7))).toBe(hash(source.slice(-7)));
  });

  it("rejects overlapping patches", () => {
    expect(() =>
      applySpanPatches("abcdef", [
        { start: 1, end: 4, replacement: "x" },
        { start: 3, end: 5, replacement: "y" }
      ])
    ).toThrow("overlap");
  });
});
