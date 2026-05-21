import { describe, expect, it } from "vitest";

import { AppError } from "../../../../src/core/util/errors.js";
import {
  OpenAiChatLlmProvider,
  type FetchFn
} from "../../../../src/providers/llm/openai-chat/openai-chat-llm.js";
import { buildTestConfig, jsonResponse } from "../../../helpers/index.js";

function makeConfig(overrides: Record<string, string> = {}) {
  return buildTestConfig({ LLM_MODEL: "test-model", ...overrides });
}

describe("OpenAiChatLlmProvider", () => {
  it("returns content and model on a successful response", async () => {
    const fetchFn: FetchFn = async () => jsonResponse({ choices: [{ message: { content: "hello world" } }] });
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    const result = await provider.chat([
      { role: "system", content: "S" },
      { role: "user", content: "U" }
    ]);

    expect(result.text).toBe("hello world");
    expect(result.model).toBe("test-model");
  });

  it("sends the lowest-common-denominator chat completion request", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: FetchFn = async (input, init) => {
      requestBody = JSON.parse(String(init?.body));
      expect(String(input)).toBe("https://llm.example/v1/chat/completions");
      expect(init?.method).toBe("POST");
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    };
    const provider = new OpenAiChatLlmProvider(makeConfig({ LLM_BASE_URL: "https://llm.example/v1" }), { fetchFn });

    await provider.chat([
      { role: "system", content: "S" },
      { role: "user", content: "U" }
    ], { maxTokens: 123, timeoutMs: 1000 });

    expect(requestBody).toEqual({
      model: "test-model",
      messages: [
        { role: "system", content: "S" },
        { role: "user", content: "U" }
      ],
      max_tokens: 123
    });
    expect(JSON.stringify(requestBody)).not.toContain('"role":"developer"');
  });

  it("merges LLM_EXTRA_BODY fields into the request body", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: FetchFn = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    };
    const provider = new OpenAiChatLlmProvider(
      makeConfig({ LLM_EXTRA_BODY: '{"temperature":0.7,"top_p":0.8,"top_k":20}' }),
      { fetchFn }
    );

    await provider.chat([{ role: "user", content: "U" }], { maxTokens: 50 });

    expect(requestBody).toMatchObject({ temperature: 0.7, top_p: 0.8, top_k: 20, max_tokens: 50 });
  });

  it("lets LLM_EXTRA_BODY override core fields including model and max_tokens", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchFn: FetchFn = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    };
    const provider = new OpenAiChatLlmProvider(
      makeConfig({ LLM_EXTRA_BODY: '{"model":"override-model","max_tokens":999}' }),
      { fetchFn }
    );

    await provider.chat([{ role: "user", content: "U" }], { maxTokens: 50 });

    expect(requestBody).toMatchObject({ model: "override-model", max_tokens: 999 });
  });

  it("sends bearer authorization when LLM API key is configured", async () => {
    let authorization: string | undefined;
    const fetchFn: FetchFn = async (_input, init) => {
      authorization = (init?.headers as Record<string, string>).authorization;
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    };
    const provider = new OpenAiChatLlmProvider(makeConfig({ LLM_API_KEY: "llm-key" }), { fetchFn });

    await provider.chat([]);

    expect(authorization).toBe("Bearer llm-key");
  });

  it("throws llm_non_json when body is not JSON", async () => {
    const fetchFn: FetchFn = async () =>
      new Response("<html>nope</html>", { status: 200, headers: { "content-type": "text/html" } });
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([])).rejects.toMatchObject({
      code: "llm_non_json",
      statusCode: 502
    });
  });

  it("slugifies upstream code on error payload", async () => {
    const fetchFn: FetchFn = async () =>
      jsonResponse({ error: { message: "ctx full", code: "Context; Length!!" } }, { status: 400 });
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([])).rejects.toMatchObject({
      code: "llm_context_length",
      statusCode: 502
    });
  });

  it("throws llm_missing_content when choices[0].message.content is missing", async () => {
    const fetchFn: FetchFn = async () => jsonResponse({ choices: [{ message: { content: "" } }] });
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([])).rejects.toMatchObject({
      code: "llm_missing_content",
      statusCode: 502
    });
  });

  it("throws llm_missing_content when choices are empty", async () => {
    const fetchFn: FetchFn = async () => jsonResponse({ choices: [] });
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([])).rejects.toMatchObject({
      code: "llm_missing_content",
      statusCode: 502
    });
  });

  it("translates AbortError into llm_timeout", async () => {
    const fetchFn: FetchFn = async (_input, init) => {
      await new Promise((_resolve, reject) => {
        const signal = (init?.signal ?? null) as AbortSignal | null;
        if (!signal) {
          reject(new Error("test setup: signal expected"));
          return;
        }
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
      throw new Error("unreachable");
    };
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([], { timeoutMs: 0 })).rejects.toMatchObject({
      name: "AppError",
      code: "llm_timeout",
      statusCode: 504
    });
  });

  it("wraps non-AppError fetch failures", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("network broke");
    };
    const provider = new OpenAiChatLlmProvider(makeConfig(), { fetchFn });

    await expect(provider.chat([])).rejects.toBeInstanceOf(AppError);
    await expect(provider.chat([])).rejects.toMatchObject({ code: "llm_request_failed", statusCode: 502 });
  });
});
