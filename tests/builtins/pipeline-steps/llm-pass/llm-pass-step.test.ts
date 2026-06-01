/** Verifies the llm-pass pipeline step behavior. */
import { describe, expect, it } from "vitest";

import type { LlmProvider } from "../../../../src/contracts/extensions/llm-provider.js";
import { LlmPassStep } from "../../../../src/builtins/pipeline-steps/llm-pass/llm-pass-step.js";
import { TemplateRenderer } from "../../../../src/shared/template-renderer.js";
import { UpstreamError } from "../../../../src/shared/errors.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("LlmPassStep", () => {
  it("skips when no body, too short, or too long", async () => {
    const step = makeStep(llm("ok"));

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "skipped", reason: "no_body" });
    await expect(step.run(makeStepContext({ body: { content: "short" } }))).resolves.toMatchObject({
      status: "skipped",
      reason: "too_short"
    });
    await expect(step.run(makeStepContext({ body: { content: "x".repeat(101) } }))).resolves.toMatchObject({
      status: "skipped",
      reason: "too_long"
    });
  });

  it("renders prompts, calls the LLM, and carries title", async () => {
    const calls: unknown[] = [];
    const step = makeStep({
      canFit: () => true,
      chat: async messages => {
        calls.push(messages);
        return { text: " cleaned " };
      }
    });

    const result = await step.run(makeStepContext({ body: { content: "source text", title: "Title" } }));

    expect(result.status).toBe("ok");
    expect(result.effects?.body).toEqual({ content: "cleaned", title: "Title" });
    expect(JSON.stringify(calls[0])).toContain("source text");
  });

  it("maps template, empty, provider, and abort failures", async () => {
    const badTemplate = makeStep(llm("ok"), new TemplateRenderer(new Map()));
    await expect(badTemplate.run(makeStepContext({ body: { content: "source text" } }))).resolves.toMatchObject({
      status: "failed",
      reason: "template_error"
    });

    await expect(makeStep(llm(" ")).run(makeStepContext({ body: { content: "source text" } }))).resolves.toMatchObject({
      status: "failed",
      reason: "empty_response"
    });
    const upstreamFailure = await makeStep(
      failingLlm(new UpstreamError("bad", "http_503", { upstreamStatus: 503 }))
    ).run(makeStepContext({ body: { content: "source text" } }));
    expect(upstreamFailure).toEqual({ status: "failed", reason: "http_503" });
    const abort = new Error("aborted");
    abort.name = "AbortError";
    await expect(
      makeStep(failingLlm(abort)).run(makeStepContext({ body: { content: "source text" } }))
    ).resolves.toMatchObject({
      status: "failed",
      reason: "timeout"
    });
  });

  it("skips with context_overflow when the provider rejects the prompt", async () => {
    const provider: LlmProvider = { canFit: () => false, chat: async () => ({ text: "ignored" }) };
    const step = new LlmPassStep(
      { templates: { system: "system", user: "user", vars: {} } },
      { templates: defaultTemplates(), llm: provider, logger: createTestLogger() }
    );

    const result = await step.run(makeStepContext({ body: { content: "source text" } }));

    expect(result).toEqual({ status: "skipped", reason: "context_overflow" });
  });

  it("computes reserveChars as max(ratio*body, absolute) and passes it to canFit", async () => {
    const seen: Array<{ prompt: string; reserve: number }> = [];
    const provider: LlmProvider = {
      canFit: (prompt, reserve) => {
        seen.push({ prompt, reserve });
        return true;
      },
      chat: async () => ({ text: "ok" })
    };
    const step = new LlmPassStep(
      {
        templates: { system: "system", user: "user", vars: {} },
        outputReserveRatio: 0.5,
        outputReserveChars: 100
      },
      { templates: defaultTemplates(), llm: provider, logger: createTestLogger() }
    );

    await step.run(makeStepContext({ body: { content: "x".repeat(50) } }));
    expect(seen[0]?.reserve).toBe(100);

    await step.run(makeStepContext({ body: { content: "x".repeat(400) } }));
    expect(seen[1]?.reserve).toBe(200);
  });

  it("defaults reserveChars to body length when no reserve config is set", async () => {
    let seenReserve = -1;
    const provider: LlmProvider = {
      canFit: (_prompt, reserve) => {
        seenReserve = reserve;
        return true;
      },
      chat: async () => ({ text: "ok" })
    };
    const step = new LlmPassStep(
      { templates: { system: "system", user: "user", vars: {} } },
      { templates: defaultTemplates(), llm: provider, logger: createTestLogger() }
    );

    await step.run(makeStepContext({ body: { content: "x".repeat(123) } }));

    expect(seenReserve).toBe(123);
  });

  it("passes templates.vars into the renderer alongside body variables", async () => {
    const provider: LlmProvider = { canFit: () => true, chat: async () => ({ text: "ok" }) };
    const templates = new TemplateRenderer(
      new Map([
        ["system", "target={{targetChars}}"],
        ["user", "{{content}}"]
      ])
    );
    let captured: string | undefined;
    const captureProvider: LlmProvider = {
      canFit: () => true,
      chat: async messages => {
        captured = messages[0]?.content;
        return { text: "ok" };
      }
    };
    const step = new LlmPassStep(
      { templates: { system: "system", user: "user", vars: { targetChars: 25000 } } },
      { templates, llm: captureProvider, logger: createTestLogger() }
    );

    await step.run(makeStepContext({ body: { content: "abc" } }));

    expect(captured).toBe("target=25000");
    void provider;
  });

  it("context_overflow fires even when maxInputChars is unset", async () => {
    const provider: LlmProvider = { canFit: () => false, chat: async () => ({ text: "ignored" }) };
    const step = new LlmPassStep(
      { templates: { system: "system", user: "user", vars: {} } },
      { templates: defaultTemplates(), llm: provider, logger: createTestLogger() }
    );

    const result = await step.run(makeStepContext({ body: { content: "x".repeat(10_000_000) } }));

    expect(result).toEqual({ status: "skipped", reason: "context_overflow" });
  });
});

function makeStep(llmProvider: LlmProvider, templates = defaultTemplates()): LlmPassStep {
  return new LlmPassStep(
    { minInputChars: 6, maxInputChars: 100, templates: { system: "system", user: "user", vars: {} } },
    { templates, llm: llmProvider, logger: createTestLogger() }
  );
}

function defaultTemplates(): TemplateRenderer {
  return new TemplateRenderer(
    new Map([
      ["system", "System {{url}}"],
      ["user", "User {{title}} {{content}}"]
    ])
  );
}

function llm(text: string): LlmProvider {
  return { canFit: () => true, chat: async () => ({ text }) };
}

function failingLlm(error: unknown): LlmProvider {
  return {
    canFit: () => true,
    chat: async () => {
      throw error;
    }
  };
}
