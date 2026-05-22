import { describe, expect, it } from "vitest";

import type { Limiters } from "../../../src/core/util/limiters.js";
import type { FetchProviderStubOptions, LlmProviderStubOptions } from "../../helpers/index.js";

import { LoadContextUseCase } from "../../../src/core/use-cases/load-context.js";
import {
  buildTestConfig,
  makeFetchProviderStub,
  makeLlmProviderStub,
  makeStage,
  makeTemplateRenderer,
  silentLimiters,
  silentLogger
} from "../../helpers/index.js";

interface UseCaseHarnessOptions {
  env?: Record<string, string>;
  fetch?: FetchProviderStubOptions;
  llm?: LlmProviderStubOptions;
  limiters?: Limiters;
}

function makeUseCaseHarness(options: UseCaseHarnessOptions = {}) {
  const config = buildTestConfig({
    CLEAN_MIN_INPUT_CHARS: "1",
    SUMMARIZE_ENABLED: "false",
    ...options.env
  });
  const templates = makeTemplateRenderer(config);
  const fetch = makeFetchProviderStub(options.fetch);
  const llm = makeLlmProviderStub({
    chat: async () => ({ text: "cleaned content body ".repeat(20), model: "stub-model" }),
    ...options.llm
  });
  const useCase = new LoadContextUseCase({
    config,
    logger: silentLogger(),
    limiters: options.limiters ?? silentLimiters(),
    fetchProvider: fetch.provider,
    cleanStage: makeStage(config, templates, llm.provider),
    summarizeStage: makeStage(config, templates, llm.provider, { summarize: true }),
    llmProviderName: llm.provider.name,
    templateRenderer: templates
  });
  return { config, fetchCalls: fetch.calls, llmCalls: llm.calls, useCase };
}

describe("LoadContextUseCase", () => {
  it("returns cleaned content with diagnostic footer", async () => {
    const { useCase } = makeUseCaseHarness();

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("clean");
    expect(document.metadata.fetch.status).toBe("ok");
    expect(document.metadata.stages.clean?.status).toBe("cleaned");
    expect(document.metadata.stages.summarize?.status).toBe("skipped_disabled");
    expect(document.pageContent).toContain("<context_loader_info");
    expect(document.pageContent).toContain('returned="clean"');
  });

  it("falls back to source content when clean output is rejected", async () => {
    const { useCase } = makeUseCaseHarness({ llm: { chat: async () => ({ text: "", model: "m" }) } });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("source");
    expect(document.metadata.stages.clean).toMatchObject({ status: "quality_rejected", reason: "empty" });
  });

  it("runs summarize after accepted clean output", async () => {
    const { useCase } = makeUseCaseHarness({
      env: { SUMMARIZE_ENABLED: "true", SUMMARIZE_MIN_INPUT_CHARS: "1" },
      llm: {
        chat: async (messages) => {
          const system = messages[0]?.content ?? "";
          if (system.includes("SUM")) return { text: "tiny summary", model: "m" };
          return { text: "cleaned content body ".repeat(20), model: "m" };
        }
      }
    });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("summary");
    expect(document.metadata.stages.clean?.status).toBe("cleaned");
    expect(document.metadata.stages.summarize?.status).toBe("summarized");
  });

  it("runs summarize on source content when clean output is rejected", async () => {
    const { useCase } = makeUseCaseHarness({
      env: { SUMMARIZE_ENABLED: "true", SUMMARIZE_MIN_INPUT_CHARS: "1" },
      llm: {
        chat: async (messages) => {
          const system = messages[0]?.content ?? "";
          if (system.includes("SUM")) return { text: "summary content ".repeat(20), model: "m" };
          return { text: "", model: "m" };
        }
      }
    });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("summary");
    expect(document.metadata.stages.clean).toMatchObject({ status: "quality_rejected", reason: "empty" });
    expect(document.metadata.stages.summarize?.status).toBe("summarized");
  });

  it("applies truncation after stage processing", async () => {
    const { useCase } = makeUseCaseHarness({
      env: { CLEAN_ENABLED: "false", SUMMARIZE_ENABLED: "false", TRUNCATE_TARGET_CHARS: "100" },
      fetch: { defaultMarkdown: "x ".repeat(5000) }
    });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("truncated");
    expect(document.metadata.stages.truncate).toMatchObject({ applied: true, originalChars: 10000 });
    expect(document.pageContent).toContain("... [TRUNCATED]");
    expect(document.pageContent).toContain('truncate_status="truncated"');
  });

  it("returns a diagnostic document when fetch fails and diagnostics are enabled", async () => {
    const { useCase } = makeUseCaseHarness({
      env: { DIAGNOSTIC_FOOTER_ENABLED: "true" },
      fetch: { fetch: async () => { throw new Error("boom"); } }
    });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata).toMatchObject({ returned: "error", error: "boom" });
    expect(document.pageContent).toContain("Failed to fetch URL: https://example.com/");
    expect(document.pageContent).toContain('returned="error"');
  });

  it("throws fetch failures when diagnostics are disabled", async () => {
    const { useCase } = makeUseCaseHarness({
      env: { DIAGNOSTIC_FOOTER_ENABLED: "false" },
      fetch: { fetch: async () => { throw new Error("boom"); } }
    });

    await expect(useCase.loadOne("https://example.com/")).rejects.toThrow("boom");
  });

  it("omits diagnostic footer when diagnostics are disabled after success", async () => {
    const { useCase } = makeUseCaseHarness({ env: { DIAGNOSTIC_FOOTER_ENABLED: "false" } });

    const document = await useCase.loadOne("https://example.com/");

    expect(document.metadata.returned).toBe("clean");
    expect(document.pageContent).not.toContain("<context_loader_info");
  });
});

