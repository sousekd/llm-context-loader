import { describe, expect, it } from "vitest";

import { normalizeUrlForComparison } from "../../../src/tools/url-reconciler/normalize.js";

describe("normalizeUrlForComparison", () => {
  it("folds scheme and host case", () => {
    const result = normalizeUrlForComparison("HTTP://EXAMPLE.COM/A");

    expect(result).toMatchObject({ kind: "url", href: "http://example.com/A", scheme: "http", host: "example.com" });
  });

  it("strips default ports and preserves non-default ports", () => {
    expect(normalizeUrlForComparison("https://example.com:443/a")).toMatchObject({ kind: "url", strictKey: "https://example.com/a" });
    expect(normalizeUrlForComparison("https://example.com:444/a")).toMatchObject({ kind: "url", strictKey: "https://example.com:444/a" });
  });

  it("decodes common HTML entities for parsing", () => {
    expect(normalizeUrlForComparison("https://example.com/a?x=1&amp;y=2")).toMatchObject({
      kind: "url",
      fetchKey: "https://example.com/a?x=1&y=2"
    });
  });

  it("resolves relative URLs when baseUrl is supplied", () => {
    expect(normalizeUrlForComparison("/a", { baseUrl: "https://example.com/root" })).toMatchObject({
      kind: "url",
      strictKey: "https://example.com/a"
    });
  });

  it("returns parse failure for relative URLs without a base", () => {
    expect(normalizeUrlForComparison("/a")).toMatchObject({ kind: "parse_failure", reason: "invalid" });
  });

  it("preserves query order in strictKey", () => {
    expect(normalizeUrlForComparison("https://example.com/a?b=2&a=1")).toMatchObject({
      kind: "url",
      strictKey: "https://example.com/a?b=2&a=1"
    });
  });

  it("keeps fragments out of fetchKey", () => {
    expect(normalizeUrlForComparison("https://example.com/a#part")).toMatchObject({
      kind: "url",
      strictKey: "https://example.com/a#part",
      fetchKey: "https://example.com/a"
    });
  });

  it("preserves trailing slash distinction", () => {
    expect(normalizeUrlForComparison("https://example.com/foo")).toMatchObject({ kind: "url", path: "/foo" });
    expect(normalizeUrlForComparison("https://example.com/foo/")).toMatchObject({ kind: "url", path: "/foo/" });
  });

  it("does not collapse encoded slashes", () => {
    expect(normalizeUrlForComparison("https://example.com/a%2Fb")).toMatchObject({ kind: "url", path: "/a%2Fb" });
  });

  it("round-trips IDN hosts through punycode", () => {
    expect(normalizeUrlForComparison("https://münich.example/a")).toMatchObject({ kind: "url", host: "xn--mnich-kva.example" });
  });

  it("handles IPv6 literal URLs", () => {
    expect(normalizeUrlForComparison("http://[::1]:8080/a")).toMatchObject({ kind: "url", host: "[::1]", strictKey: "http://[::1]:8080/a" });
  });

  it("rejects unsupported schemes by default", () => {
    expect(normalizeUrlForComparison("mailto:test@example.com")).toMatchObject({ kind: "parse_failure", reason: "unsupported_scheme" });
  });

  it("accepts explicitly allowed schemes", () => {
    expect(normalizeUrlForComparison("mailto:test@example.com", { allowedSchemes: ["mailto"] })).toMatchObject({ kind: "url", scheme: "mailto" });
  });

  it("returns parse failure for garbage and empty input", () => {
    expect(normalizeUrlForComparison("not a url")).toMatchObject({ kind: "parse_failure", reason: "invalid" });
    expect(normalizeUrlForComparison("   ")).toMatchObject({ kind: "parse_failure", reason: "empty" });
  });
});
