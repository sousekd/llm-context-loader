import { describe, expect, it } from "vitest";

import { truncate } from "../../../src/core/cleanup/truncate.js";

const marker = "\n\n... [TRUNCATED]";

describe("truncate", () => {
  it("returns input unchanged when under the target", () => {
    const result = truncate("short text", 100);

    expect(result).toEqual({ output: "short text", truncated: false, originalChars: 10, outputChars: 10 });
  });

  it("returns input unchanged when the target is disabled", () => {
    expect(truncate("anything", 0)).toMatchObject({ output: "anything", truncated: false });
    expect(truncate("anything", -1)).toMatchObject({ output: "anything", truncated: false });
  });

  it("cuts near whitespace and appends the marker", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta iota";

    const result = truncate(text, 20);
    const body = result.output.slice(0, -marker.length);

    expect(result.truncated).toBe(true);
    expect(result.output.endsWith(marker)).toBe(true);
    expect(text.startsWith(body)).toBe(true);
    expect(body[body.length - 1]).not.toBe(" ");
  });

  it("falls back to the hard cut when no whitespace is found in the tail", () => {
    const text = "a".repeat(200);

    const result = truncate(text, 50);

    expect(result.truncated).toBe(true);
    expect(result.output).toBe(`${"a".repeat(50)}${marker}`);
  });

  it("reports original and output char counts", () => {
    const text = "x".repeat(100);

    const result = truncate(text, 30);

    expect(result.originalChars).toBe(100);
    expect(result.outputChars).toBe(result.output.length);
  });
});
