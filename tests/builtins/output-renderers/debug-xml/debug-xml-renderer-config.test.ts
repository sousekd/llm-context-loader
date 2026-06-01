/** Verifies debug-xml renderer configuration parsing. */
import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../../../../src/shared/errors.js";
import { parseDebugXmlRendererConfig } from "../../../../src/builtins/output-renderers/debug-xml/debug-xml-renderer-config.js";

describe("parseDebugXmlRendererConfig", () => {
  it("defaults includeSkipped to false and parses boolean strings", () => {
    expect(parseDebugXmlRendererConfig({})).toMatchObject({ rootElement: "loader_info", includeSkipped: false });
    expect(parseDebugXmlRendererConfig({ includeSkipped: "true" })).toMatchObject({ includeSkipped: true });
    expect(parseDebugXmlRendererConfig({ includeSkipped: " FALSE " })).toMatchObject({ includeSkipped: false });
    expect(parseDebugXmlRendererConfig({ includeSkipped: "" })).toMatchObject({ includeSkipped: false });
  });

  it("rejects invalid boolean strings", () => {
    expect(() => parseDebugXmlRendererConfig({ includeSkipped: "yes" })).toThrow();
  });

  it("rejects invalid diagnostic root names", () => {
    expect(() => parseDebugXmlRendererConfig({ rootElement: "ContextLoader" })).toThrow(ConfigurationError);
    expect(() => parseDebugXmlRendererConfig({ rootElement: "ContextLoader" })).toThrow(/Invalid rootElement/);
  });
});
