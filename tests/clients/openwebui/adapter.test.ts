import { describe, expect, it } from "vitest";

import { toOpenWebUiDocuments } from "../../../src/clients/openwebui/adapter.js";
import { makeContextDoc } from "../../helpers/index.js";

describe("toOpenWebUiDocuments", () => {
  it("maps page content and core metadata to OpenWebUI fields", () => {
    const document = makeContextDoc("https://example.com/", {
      pageContent: "hello",
      metadata: {
        title: "Example",
        fetchProvider: "firecrawl",
        llmProvider: "openai_chat",
        returned: "summary",
        finalChars: 50,
        fetch: { status: "ok", durationMs: 12, chars: 200 }
      }
    });

    const [row] = toOpenWebUiDocuments([document]);

    expect(row).toEqual({
      page_content: "hello",
      metadata: expect.objectContaining({
        source: "https://example.com/",
        title: "Example",
        loader: "llm-context-loader",
        fetch_provider: "firecrawl",
        llm_provider: "openai_chat",
        returned: "summary",
        final_chars: 50,
        fetch_status: "ok",
        fetch_duration_ms: 12,
        fetch_chars: 200
      })
    });
  });

  it("maps clean, summarize, and truncate metadata when present", () => {
    const document = makeContextDoc("https://example.com/", {
      metadata: {
        stages: {
          clean: { status: "cleaned", durationMs: 30, inputChars: 200, outputChars: 100, ratio: 0.5, model: "m" },
          summarize: { status: "summarized", durationMs: 40, inputChars: 100, outputChars: 50, ratio: 0.5, model: "m" },
          truncate: { applied: false, originalChars: 50, outputChars: 50 }
        }
      }
    });

    const metadata = toOpenWebUiDocuments([document])[0].metadata;

    expect(metadata).toMatchObject({
      clean_status: "cleaned",
      clean_duration_ms: 30,
      clean_input_chars: 200,
      clean_output_chars: 100,
      clean_ratio: 0.5,
      clean_model: "m",
      summarize_status: "summarized",
      summarize_duration_ms: 40,
      summarize_input_chars: 100,
      summarize_output_chars: 50,
      summarize_ratio: 0.5,
      summarize_model: "m",
      truncate_applied: false,
      truncate_original_chars: 50,
      truncate_output_chars: 50
    });
  });

  it("omits stage keys when stages are absent", () => {
    const document = makeContextDoc("https://example.com/", {
      metadata: { returned: "error", error: "boom", stages: {} }
    });

    const metadata = toOpenWebUiDocuments([document])[0].metadata;

    expect(metadata.clean_status).toBeUndefined();
    expect(metadata.summarize_status).toBeUndefined();
    expect(metadata.truncate_applied).toBeUndefined();
    expect(metadata.error).toBe("boom");
  });
});
