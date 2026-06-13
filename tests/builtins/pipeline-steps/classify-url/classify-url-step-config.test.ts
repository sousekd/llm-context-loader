/** Verifies the classify-url step configuration and matcher compilation. */
import { describe, expect, it } from "vitest";

import { parseClassifyUrlStepConfig } from "../../../../src/builtins/pipeline-steps/classify-url/classify-url-step-config.js";
import { ConfigurationError } from "../../../../src/shared/errors.js";

describe("parseClassifyUrlStepConfig", () => {
  it("accepts empty rules", () => {
    const config = parseClassifyUrlStepConfig({ rules: [] });
    expect(config.rules).toEqual([]);
  });

  it("compiles a pattern matcher", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "binary_doc", pattern: "\\.pdf($|\\?|#)" }]
    });
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0]?.match("https://example.com/doc.pdf")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/doc.pdf?dl=1")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/doc")).toBe(false);
  });

  it("compiles an anyHost matcher", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "code_host", anyHost: ["github.com"] }]
    });
    expect(config.rules[0]?.match("https://github.com/user/repo")).toBe(true);
    expect(config.rules[0]?.match("https://www.github.com/user/repo")).toBe(true);
    expect(config.rules[0]?.match("https://gist.github.com/user/repo")).toBe(true);
    expect(config.rules[0]?.match("https://gitlab.com/user/repo")).toBe(false);
  });

  it("compiles an extensionIn matcher", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "binary_doc", extensionIn: ["pdf", "docx"] }]
    });
    expect(config.rules[0]?.match("https://example.com/doc.pdf")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/doc.PDF?foo=1")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/file.docx")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/doc")).toBe(false);
    expect(config.rules[0]?.match("https://example.com/doc.txt")).toBe(false);
  });

  it("rejects rules with multiple matchers", () => {
    expect(() =>
      parseClassifyUrlStepConfig({
        rules: [{ signal: "x", pattern: ".*", anyHost: ["a.com"] }]
      })
    ).toThrow("Exactly one of pattern, anyHost, or extensionIn is required per rule");
  });

  it("rejects rules with no matchers", () => {
    expect(() =>
      parseClassifyUrlStepConfig({
        rules: [{ signal: "x" }]
      })
    ).toThrow("Exactly one of pattern, anyHost, or extensionIn is required per rule");
  });

  it("rejects invalid regex pattern", () => {
    expect(() =>
      parseClassifyUrlStepConfig({
        rules: [{ signal: "x", pattern: "(" }]
      })
    ).toThrow(ConfigurationError);
  });

  it("rejects invalid signal names", () => {
    expect(() =>
      parseClassifyUrlStepConfig({
        rules: [{ signal: "BinaryDoc", pattern: "\\.pdf" }]
      })
    ).toThrow(ConfigurationError);
  });

  it("normalizes host names (www strip, leading dot strip)", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "code", anyHost: [".GitHub.Com", "WWW.example.com"] }]
    });
    expect(config.rules[0]?.match("https://github.com/repo")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/page")).toBe(true);
  });

  it("normalizes extensions (leading dot strip)", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "bin", extensionIn: [".PDF", "DOCX"] }]
    });
    expect(config.rules[0]?.match("https://example.com/file.pdf")).toBe(true);
    expect(config.rules[0]?.match("https://example.com/file.docx")).toBe(true);
  });

  it("silently returns false from match on invalid URL", () => {
    const config = parseClassifyUrlStepConfig({
      rules: [{ signal: "c", anyHost: ["a.com"] }]
    });
    expect(config.rules[0]?.match("not a url")).toBe(false);
    const extConfig = parseClassifyUrlStepConfig({
      rules: [{ signal: "c", extensionIn: ["pdf"] }]
    });
    expect(extConfig.rules[0]?.match("not a url")).toBe(false);
  });
});
