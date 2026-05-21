import { describe, expect, it } from "vitest";

import { assessQuality } from "../../../src/core/cleanup/quality-gate.js";

const qualityOptions = { minRatio: 0.05, checkUrls: true };

function sourceText(repeats = 200): string {
  return "alpha beta gamma delta epsilon zeta eta theta ".repeat(repeats);
}

describe("assessQuality", () => {
  it("rejects empty output", () => {
    const result = assessQuality(sourceText(), "", qualityOptions);

    expect(result).toMatchObject({ ok: false, reason: "empty" });
  });

  it("rejects introduced URLs when checkUrls=true", () => {
    const result = assessQuality(sourceText(), "see https://evil.example/x for more", qualityOptions);

    expect(result).toMatchObject({ ok: false, reason: "unexpected_urls", unexpectedUrls: ["https://evil.example/x"] });
  });

  it("allows introduced URLs when checkUrls=false", () => {
    const output = "y ".repeat(500) + "https://evil.example/x";

    const result = assessQuality("x ".repeat(2000), output, { ...qualityOptions, checkUrls: false });

    expect(result.reason).not.toBe("unexpected_urls");
    expect(result.unexpectedUrls).toEqual([]);
  });

  it("rejects ineffective output (not smaller than source)", () => {
    const source = "abcdefghij".repeat(100);
    const output = `${source}extra`;

    const result = assessQuality(source, output, qualityOptions);

    expect(result).toMatchObject({ ok: false, reason: "ineffective" });
  });

  it("rejects too_small_ratio when ratio is well below threshold", () => {
    const result = assessQuality("alpha ".repeat(500), "x", qualityOptions);

    expect(result).toMatchObject({ ok: false, reason: "too_small_ratio" });
  });

  it("accepts smaller output above the minimum ratio", () => {
    const result = assessQuality(sourceText(200), sourceText(100), qualityOptions);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThan(1);
  });

  it("counts source/output URLs", () => {
    const source = "see https://a.example and https://b.example";
    const output = "https://a.example only";

    const result = assessQuality(source, output, qualityOptions);

    expect(result.sourceUrlCount).toBe(2);
    expect(result.outputUrlCount).toBe(1);
    expect(result.unexpectedUrls).toEqual([]);
  });

  it("normalizes trailing punctuation in matched URLs", () => {
    const result = assessQuality("see https://a.example/x.", "https://a.example/x,", qualityOptions);

    expect(result.unexpectedUrls).toEqual([]);
  });
});
