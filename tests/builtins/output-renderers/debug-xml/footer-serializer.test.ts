/** Verifies deterministic XML diagnostic footer serialization. */
import { describe, expect, it } from "vitest";

import type { DiagnosticValue } from "../../../../src/contracts/pipeline/diagnostics.js";
import type { PipelineReport } from "../../../../src/contracts/pipeline/report.js";
import { serializeFooter } from "../../../../src/builtins/output-renderers/debug-xml/footer-serializer.js";

describe("serializeFooter", () => {
  it("escapes attributes and renders step elements", () => {
    const footer = serializeFooter(makeReport(), { rootElement: "loader_info", includeSkipped: true });

    expect(footer).toContain('url="https://example.com/?a=1&amp;b=2"');
    expect(footer).toContain('ratio="1.000"');
    expect(footer).toContain('<firecrawl status="ok" duration_ms="2" output_length="12" title="A &amp; B"/>');
    expect(footer).toContain('<truncate status="skipped" reason="under_target" duration_ms="1" input_length="12"/>');
  });

  it("can omit skipped step elements", () => {
    const footer = serializeFooter(makeReport(), { rootElement: "loader_info", includeSkipped: false });

    expect(footer).toContain("<firecrawl");
    expect(footer).not.toContain("<truncate");
  });

  it("rejects invalid diagnostic names", () => {
    expect(() => serializeFooter(makeReport(), { rootElement: "ContextLoader", includeSkipped: true })).toThrow(
      "Invalid diagnostic name"
    );
  });

  it("recurses through child report nodes", () => {
    const report = makeReport();
    const footer = serializeFooter(
      {
        ...report,
        steps: [
          { ...report.steps[0]!, diagnostics: { children: [{ name: "child_node", attributes: { value: "x" } }] } }
        ]
      },
      { rootElement: "loader_info", includeSkipped: true }
    );

    expect(footer).toContain('<child_node value="x"/>');
  });

  it("omits empty-string, null, and undefined attributes", () => {
    const report = makeReport();
    const footer = serializeFooter(
      {
        ...report,
        steps: [
          {
            ...report.steps[0]!,
            diagnostics: {
              attributes: {
                title: "",
                note: null as unknown as DiagnosticValue,
                kept: "yes",
                absent: undefined as unknown as DiagnosticValue
              }
            }
          }
        ]
      },
      { rootElement: "loader_info", includeSkipped: true }
    );

    expect(footer).toContain('kept="yes"');
    expect(footer).not.toContain("title=");
    expect(footer).not.toContain("note=");
    expect(footer).not.toContain("absent=");
  });
});

function makeReport(): PipelineReport {
  return {
    url: "https://example.com/?a=1&b=2",
    startedAt: 1,
    durationMs: 3,
    initialLength: 12,
    finalLength: 12,
    ratio: 1,
    returned: "firecrawl",
    result: "ok",
    bodyProducedBy: "firecrawl",
    bodyChangedBy: "firecrawl",
    steps: [
      {
        name: "firecrawl",
        type: "fetch",
        status: "ok",
        startedAt: 1,
        durationMs: 2,
        outputLength: 12,
        diagnostics: { attributes: { title: "A & B" } }
      },
      {
        name: "truncate",
        type: "truncate",
        status: "skipped",
        reason: "under_target",
        startedAt: 3,
        durationMs: 1,
        inputLength: 12
      }
    ]
  };
}
