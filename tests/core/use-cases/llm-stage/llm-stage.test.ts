import { describe, expect, it } from "vitest";

import type { LlmProviderStubOptions } from "../../../helpers/index.js";

import {
    LlmStage,
    cleanConfigFromAppConfig,
    summarizeConfigFromAppConfig,
    type LlmStageConfig,
    type LlmStageInput
} from "../../../../src/core/use-cases/llm-stage/llm-stage.js";
import { AppError } from "../../../../src/core/util/errors.js";
import { buildTestConfig, makeLlmProviderStub, makeTemplateRenderer } from "../../../helpers/index.js";

function makeStageInput(overrides: Partial<LlmStageInput> = {}): LlmStageInput {
    return {
        url: "https://example.com/",
        title: "Example",
        content: "alpha beta gamma delta epsilon zeta eta theta ".repeat(200),
        ...overrides
    };
}

function makeStageHarness(
    configOverrides: Partial<LlmStageConfig> = {},
    llmOptions: LlmProviderStubOptions = {},
    envOverrides: Record<string, string> = {}
) {
    const app = buildTestConfig(envOverrides);
    const templates = makeTemplateRenderer(app);
    const { provider, calls } = makeLlmProviderStub(llmOptions);
    const config: LlmStageConfig = { ...cleanConfigFromAppConfig(app), ...configOverrides };
    const stage = new LlmStage({ config, app, llm: provider, templates });
    return { app, calls, provider, stage, templates };
}

describe("LlmStage", () => {
    it("returns skipped_disabled when the stage is disabled", async () => {
        const { stage } = makeStageHarness({ enabled: false });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "skipped_disabled" } });
    });

    it("returns skipped_short when input is below minInputChars", async () => {
        const { stage } = makeStageHarness({ minInputChars: 500 });

        const result = await stage.run(makeStageInput({ content: "small" }));

        expect(result.footer.status).toBe("skipped_short");
    });

    it("returns skipped_too_long when input exceeds maxInputChars", async () => {
        const { stage } = makeStageHarness({ minInputChars: 1, maxInputChars: 50 });

        const result = await stage.run(makeStageInput());

        expect(result.footer.status).toBe("skipped_too_long");
    });

    it("returns llm_failed when template rendering fails", async () => {
        const app = buildTestConfig();
        const templates = makeTemplateRenderer(app, { cleanSystem: "{{#bad}}" });
        const { provider } = makeLlmProviderStub();
        const stage = new LlmStage({ config: { ...cleanConfigFromAppConfig(app), minInputChars: 1 }, app, llm: provider, templates });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "llm_failed" } });
    });

    it("returns timeout for LLM timeout errors", async () => {
        const { stage } = makeStageHarness(
            { minInputChars: 1 },
            { chat: async () => { throw new AppError("timed out", "llm_timeout", 504); } }
        );

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "timeout", reason: "llm_timeout" } });
    });

    it("returns llm_failed for non-timeout LLM errors", async () => {
        const { stage } = makeStageHarness(
            { minInputChars: 1 },
            { chat: async () => { throw new AppError("boom", "llm_non_json", 502); } }
        );

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "llm_failed", reason: "llm_non_json" } });
    });

    it("returns quality_rejected for empty output", async () => {
        const { stage } = makeStageHarness({ minInputChars: 1 }, { chat: async () => ({ text: "", model: "m" }) });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "quality_rejected", reason: "empty", model: "m" } });
    });

    it("returns quality_rejected for ineffective output", async () => {
        const source = "alpha ".repeat(200);
        const { stage } = makeStageHarness({ minInputChars: 1 }, { chat: async () => ({ text: `${source}extra`, model: "m" }) });

        const result = await stage.run(makeStageInput({ content: source }));

        expect(result).toMatchObject({ accepted: false, footer: { status: "quality_rejected", reason: "ineffective" } });
    });

    it("accepts smaller output and reports the clean footer", async () => {
        const output = "alpha beta gamma delta epsilon zeta eta theta ".repeat(50);
        const { stage } = makeStageHarness({ minInputChars: 1 }, { chat: async () => ({ text: output, model: "stub-model" }) });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({
            accepted: true,
            output,
            footer: { status: "cleaned", model: "stub-model", outputChars: output.trim().length }
        });
        expect(result.footer.ratio).toBeGreaterThan(0);
        expect(result.footer.ratio).toBeLessThan(1);
    });

    it("sends rendered prompts and stage options to the LLM", async () => {
        const output = "alpha beta gamma delta epsilon zeta eta theta ".repeat(50);
        const { calls, stage } = makeStageHarness({ minInputChars: 1, outputRatio: 0.25, timeoutMs: 1234 }, {
            chat: async () => ({ text: output, model: "m" })
        });

        await stage.run(makeStageInput({ content: "word ".repeat(100) }));

        expect(calls[0]).toMatchObject({
            messages: [
                { role: "system", content: "CLEAN_SYS" },
                { role: "user", content: expect.stringContaining("word") }
            ],
            options: { maxTokens: 31, timeoutMs: 1234 }
        });
    });

    it("returns summarize success status when configured as summarize", async () => {
        const app = buildTestConfig({ SUMMARIZE_ENABLED: "true", SUMMARIZE_MIN_INPUT_CHARS: "1" });
        const templates = makeTemplateRenderer(app);
        const output = "alpha beta gamma delta epsilon zeta eta theta ".repeat(50);
        const { provider } = makeLlmProviderStub({ chat: async () => ({ text: output, model: "m" }) });
        const stage = new LlmStage({ config: summarizeConfigFromAppConfig(app), app, llm: provider, templates });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: true, footer: { status: "summarized" } });
    });

    it("maps clean and summarize URL checking from separate env keys", () => {
        const app = buildTestConfig({ CLEAN_CHECK_URLS: "false", SUMMARIZE_CHECK_URLS: "true" });

        expect(cleanConfigFromAppConfig(app).checkUrls).toBe(false);
        expect(summarizeConfigFromAppConfig(app).checkUrls).toBe(true);
    });

    it("allows introduced URLs when summarize checkUrls=false", async () => {
        const app = buildTestConfig({ SUMMARIZE_ENABLED: "true", SUMMARIZE_MIN_INPUT_CHARS: "1" });
        const templates = makeTemplateRenderer(app);
        const output = `${"alpha beta gamma delta ".repeat(100)} https://hallucinated.example/x`;
        const { provider } = makeLlmProviderStub({ chat: async () => ({ text: output, model: "m" }) });
        const stage = new LlmStage({ config: summarizeConfigFromAppConfig(app), app, llm: provider, templates });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: true, footer: { status: "summarized" } });
    });

    it("rejects introduced URLs when summarize checkUrls=true", async () => {
        const app = buildTestConfig({ SUMMARIZE_ENABLED: "true", SUMMARIZE_MIN_INPUT_CHARS: "1", SUMMARIZE_CHECK_URLS: "true" });
        const templates = makeTemplateRenderer(app);
        const output = `${"alpha beta gamma delta ".repeat(100)} https://hallucinated.example/x`;
        const { provider } = makeLlmProviderStub({ chat: async () => ({ text: output, model: "m" }) });
        const stage = new LlmStage({ config: summarizeConfigFromAppConfig(app), app, llm: provider, templates });

        const result = await stage.run(makeStageInput());

        expect(result).toMatchObject({ accepted: false, footer: { status: "quality_rejected", reason: "unexpected_urls" } });
    });
});
