import { describe, expect, it } from "vitest";

import { normalizeCodeForComparison, normalizeLanguageAlias, splitCodeLines } from "../../../src/tools/code-reconciler/normalize.js";

describe("normalizeCodeForComparison", () => {
  it("normalizes line endings to LF by default", () => {
    expect(normalizeCodeForComparison("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("can trim trailing whitespace and final newlines", () => {
    expect(normalizeCodeForComparison("a  \n\n", { trimFinalNewline: true, trimTrailingLineWs: true })).toBe("a");
  });

  it("can collapse indented blank lines", () => {
    expect(normalizeCodeForComparison("a\n   \nb", { collapseIndentedBlankLines: true })).toBe("a\n\nb");
  });

  it("preserves CRLF when lineEndings is preserve", () => {
    expect(normalizeCodeForComparison("a\r\nb\r\n", { lineEndings: "preserve" })).toBe("a\r\nb\r\n");
  });
});

describe("normalizeLanguageAlias", () => {
  it("normalizes known aliases", () => {
    expect(normalizeLanguageAlias("TS")).toBe("typescript");
    expect(normalizeLanguageAlias(".py")).toBe("python");
  });

  it("returns undefined for empty input", () => {
    expect(normalizeLanguageAlias("   ")).toBeUndefined();
  });

  it("passes through unknown languages lowercased", () => {
    expect(normalizeLanguageAlias("Rust")).toBe("rust");
  });
});

describe("splitCodeLines", () => {
  it("splits logical lines without adding a final empty line for terminal newline", () => {
    expect(splitCodeLines("a\nb\n")).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitCodeLines("")).toEqual([]);
  });

  it("keeps a trailing blank line when there are two terminal newlines", () => {
    expect(splitCodeLines("a\nb\n\n")).toEqual(["a", "b", ""]);
  });
});
