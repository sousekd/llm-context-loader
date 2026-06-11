/** Verifies built-in output renderer contracts and public rendering behavior. */
import { describe, expect, it } from "vitest";

import { DebugXmlRenderer } from "../../../src/builtins/output-renderers/debug-xml/debug-xml-renderer.js";
import { PassthroughRenderer } from "../../../src/builtins/output-renderers/passthrough/passthrough-renderer.js";
import { assertOutputRendererConformance, makeRenderInput } from "../../contracts/output-renderer-conformance.js";
import { createTestLogger } from "../../helpers/logger.js";

describe("built-in output renderers", () => {
  it("debug-xml satisfies the OutputRenderer contract", async () => {
    await assertOutputRendererConformance(
      new DebugXmlRenderer({ rootElement: "loader_info", includeSkipped: true }, { logger: createTestLogger() })
    );
  });

  it("debug-xml appends a diagnostic footer after body content", () => {
    const renderer = new DebugXmlRenderer(
      { rootElement: "loader_info", includeSkipped: true },
      { logger: createTestLogger() }
    );

    const output = renderer.render(
      makeRenderInput({ body: { kind: "text", content: "hello", mediaType: "text/markdown" } })
    );

    expect(output.markdown).toContain("hello\n\n<loader_info");
    expect(output.markdown).toContain('result="ok"');
  });

  it("passthrough satisfies the OutputRenderer contract", async () => {
    await assertOutputRendererConformance(new PassthroughRenderer());
  });

  it("passthrough renders failed no-body reports as content", () => {
    const input = makeRenderInput();
    const renderer = new PassthroughRenderer();

    const output = renderer.render({
      ...input,
      body: undefined,
      report: {
        ...input.report,
        result: "failed",
        returned: "none",
        initialLength: 0,
        finalLength: 0,
        error: "source: timeout"
      }
    });

    expect(output.markdown).toBe("source: timeout");
  });

  it("passthrough returns a default failure message when no error is present", () => {
    const input = makeRenderInput();
    const renderer = new PassthroughRenderer();

    const output = renderer.render({
      ...input,
      body: undefined,
      report: { ...input.report, result: "failed", returned: "none", initialLength: 0, finalLength: 0 }
    });

    expect(output.markdown).toBe("Pipeline failed.");
  });
});
