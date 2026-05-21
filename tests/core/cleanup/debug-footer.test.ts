import { describe, expect, it } from "vitest";

import { appendFooter, escapeAttr, footerVariables } from "../../../src/core/cleanup/debug-footer.js";
import { TemplateRenderer } from "../../../src/core/cleanup/templates.js";
import { buildTestConfig, FOOTER_TEMPLATE, makeFooterInfo } from "../../helpers/index.js";

describe("debug-footer", () => {
  describe("footerVariables", () => {
    it("returns core attributes in snake_case", () => {
      const variables = footerVariables(makeFooterInfo({
        returned: "clean",
        sourceUrl: "https://example.com",
        title: "Title",
        finalChars: 42,
        fetchProvider: "firecrawl",
        llmProvider: "openai_chat",
        fetch: { status: "ok", durationMs: 12, chars: 100 }
      }));

      expect(variables).toMatchObject({
        returned: "clean",
        source_url: "https://example.com",
        title: "Title",
        final_chars: 42,
        fetch_provider: "firecrawl",
        llm_provider: "openai_chat",
        fetch_status: "ok",
        fetch_duration_ms: 12,
        fetch_chars: 100
      });
    });

    it("omits per-stage attributes when stages are absent", () => {
      const variables = footerVariables(makeFooterInfo({ returned: "source", stages: {} }));

      expect(variables.clean_status).toBeUndefined();
      expect(variables.summarize_status).toBeUndefined();
      expect(variables.truncate_status).toBeUndefined();
    });

    it("returns stage attributes when stages ran", () => {
      const variables = footerVariables(makeFooterInfo({
        returned: "summary",
        stages: {
          clean: { status: "cleaned", durationMs: 30, inputChars: 200, outputChars: 150, ratio: 0.75, model: "m" },
          summarize: { status: "summarized", durationMs: 40, inputChars: 150, outputChars: 50, ratio: 0.333, model: "m" },
          truncate: { applied: false, originalChars: 50, outputChars: 50 }
        }
      }));

      expect(variables).toMatchObject({
        clean_status: "cleaned",
        clean_ratio: "0.750",
        clean_model: "m",
        summarize_status: "summarized",
        summarize_ratio: "0.333",
        summarize_model: "m",
        truncate_status: "intact",
        truncate_original_chars: 50,
        truncate_output_chars: 50
      });
    });

    it("returns truncated status when truncation applied", () => {
      const variables = footerVariables(makeFooterInfo({
        returned: "truncated",
        stages: { truncate: { applied: true, originalChars: 1000, outputChars: 100 } }
      }));

      expect(variables.truncate_status).toBe("truncated");
    });

    it("omits empty strings and non-finite numbers", () => {
      const variables = footerVariables(makeFooterInfo({ title: "   ", finalChars: Number.NaN }));

      expect(variables.title).toBeUndefined();
      expect(variables.final_chars).toBeNaN();
    });
  });

  describe("XML attribute escaping", () => {
    it("escapes attribute special characters", () => {
      expect(escapeAttr(`a <b> "c" & 'd'`)).toBe("a &lt;b&gt; &quot;c&quot; &amp; &apos;d&apos;");
    });

    it("escapes footer variable strings at the XML attribute boundary", () => {
      const variables = footerVariables(makeFooterInfo({ returned: "error", error: `a <b> "c" & 'd'` }));

      expect(variables.error).toBe("a &lt;b&gt; &quot;c&quot; &amp; &apos;d&apos;");
    });
  });

  describe("appendFooter", () => {
    it("appends footer on its own line and trims trailing body whitespace", () => {
      const result = appendFooter("hello\n\n   ", '<context_loader_info returned="clean" />');

      expect(result).toBe('hello\n\n<context_loader_info returned="clean" />\n');
    });

    it("returns trimmed body when footer is empty", () => {
      expect(appendFooter("hello\n", "   ")).toBe("hello");
    });
  });

  describe("footer rendering", () => {
    it("renders present-only footer attributes", async () => {
      const config = buildTestConfig();
      const renderer = new TemplateRenderer(config, async () => FOOTER_TEMPLATE);

      const xml = await renderer.renderFooter(makeFooterInfo({
        returned: "clean",
        sourceUrl: "https://example.com",
        stages: {
          clean: { status: "cleaned", durationMs: 30, inputChars: 100, outputChars: 50, ratio: 0.5 }
        }
      }));

      expect(xml).toContain('returned="clean"');
      expect(xml).toContain('source_url="https://example.com"');
      expect(xml).toContain('clean_status="cleaned"');
      expect(xml).toContain('clean_ratio="0.500"');
      expect(xml).not.toContain("summarize_status");
      expect(xml).not.toContain("truncate_status");
    });
  });
});
