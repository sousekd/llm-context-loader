/** Verifies OpenAI-compatible chat provider request, response, and failure behavior. */
import { describe, expect, it } from "vitest";

import { UpstreamError } from "../../../../src/shared/errors.js";
import { parseOpenAiChatConfig } from "../../../../src/builtins/llm-providers/openai-chat/openai-chat-provider-config.js";
import { OpenAiChatProvider } from "../../../../src/builtins/llm-providers/openai-chat/openai-chat-provider.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { jsonResponse } from "../../../helpers/responses.js";

describe("OpenAiChatProvider", () => {
  it("sends lowest-common-denominator chat completions requests", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const provider = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", apiKey: "", model: "test-model" }),
      {
        httpFetch: async (input, init) => {
          requestBody = JSON.parse(String(init?.body));
          expect(String(input)).toBe("https://llm.example/v1/chat/completions");
          return jsonResponse({ choices: [{ message: { content: "ok" } }] });
        },
        logger: createTestLogger()
      }
    );

    const result = await provider.chat(
      [
        { role: "system", content: "S" },
        { role: "user", content: "U" }
      ],
      { signal: new AbortController().signal }
    );

    expect(result.text).toBe("ok");
    expect(requestBody).toEqual({
      model: "test-model",
      messages: [
        { role: "system", content: "S" },
        { role: "user", content: "U" }
      ]
    });
    expect(JSON.stringify(requestBody)).not.toContain("developer");
  });

  it("spreads extraBody last and sends bearer auth", async () => {
    let requestBody: Record<string, unknown> | undefined;
    let authorization: string | undefined;
    const provider = new OpenAiChatProvider(
      parseOpenAiChatConfig({
        baseUrl: "https://llm.example/v1",
        apiKey: "llm-key",
        model: "test-model",
        extraBody: { model: "override", temperature: 0.7 }
      }),
      {
        httpFetch: async (_input, init) => {
          requestBody = JSON.parse(String(init?.body));
          authorization = (init?.headers as Record<string, string>).authorization;
          return jsonResponse({ choices: [{ message: { content: "ok" } }] });
        },
        logger: createTestLogger()
      }
    );

    await provider.chat([{ role: "user", content: "U" }], { signal: new AbortController().signal });

    expect(requestBody).toMatchObject({ model: "override", temperature: 0.7 });
    expect(authorization).toBe("Bearer llm-key");
  });

  it("accepts text completions from the first choice", async () => {
    const provider = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () => jsonResponse({ choices: [{ text: "plain text" }] }),
        logger: createTestLogger()
      }
    );

    const result = await provider.chat([{ role: "user", content: "U" }], { signal: new AbortController().signal });

    expect(result.text).toBe("plain text");
  });

  it("maps malformed and upstream error responses to UpstreamError", async () => {
    const malformed = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () => new Response("<html></html>", { status: 200 }),
        logger: createTestLogger()
      }
    );
    await expect(malformed.chat([], { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "parse_error"
    });

    const upstream = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () =>
          jsonResponse({ error: { message: "ctx full", code: "Context; Length!!" } }, { status: 400 }),
        logger: createTestLogger()
      }
    );
    await expect(upstream.chat([], { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "context_length",
      upstreamStatus: 400
    });
  });

  it("throws empty_response and wraps network errors", async () => {
    const empty = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () => jsonResponse({ choices: [{ message: { content: "" } }] }),
        logger: createTestLogger()
      }
    );
    await expect(empty.chat([], { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "empty_response"
    });

    const network = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () => {
          throw new Error("network broke");
        },
        logger: createTestLogger()
      }
    );
    await expect(network.chat([], { signal: new AbortController().signal })).rejects.toBeInstanceOf(UpstreamError);
    await expect(network.chat([], { signal: new AbortController().signal })).rejects.toMatchObject({
      upstreamCode: "network"
    });
  });

  it("forwards AbortSignal and lets abort errors propagate", async () => {
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    let signal: AbortSignal | null | undefined;
    const provider = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async (_input, init) => {
          signal = init?.signal;
          throw abort;
        },
        logger: createTestLogger()
      }
    );

    await expect(provider.chat([], { signal: controller.signal })).rejects.toBe(abort);

    expect(signal).toBe(controller.signal);
  });

  it("lets abort errors from JSON parsing propagate", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const response = jsonResponse({ choices: [{ message: { content: "ok" } }] });
    Object.defineProperty(response, "json", { value: async () => Promise.reject(abort) });
    const provider = new OpenAiChatProvider(
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
      {
        httpFetch: async () => response,
        logger: createTestLogger()
      }
    );

    await expect(provider.chat([], { signal: new AbortController().signal })).rejects.toBe(abort);
  });

  describe("canFit", () => {
    it("returns true when contextTokens is not configured", () => {
      const provider = new OpenAiChatProvider(
        parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model" }),
        {
          httpFetch: async () => new Response(),
          logger: createTestLogger()
        }
      );
      expect(provider.canFit("a".repeat(1_000_000), 1_000_000)).toBe(true);
    });

    it("uses charsPerToken to estimate prompt + reserve against contextTokens", () => {
      const provider = new OpenAiChatProvider(
        parseOpenAiChatConfig({
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          contextTokens: 1000,
          charsPerToken: 4
        }),
        { httpFetch: async () => new Response(), logger: createTestLogger() }
      );
      expect(provider.canFit("a".repeat(2000), 1600)).toBe(true);
      expect(provider.canFit("a".repeat(2000), 2000)).toBe(true);
      expect(provider.canFit("a".repeat(2000), 2001)).toBe(false);
    });

    it("subtracts safetyMarginTokens from the available budget", () => {
      const provider = new OpenAiChatProvider(
        parseOpenAiChatConfig({
          baseUrl: "https://llm.example/v1",
          model: "test-model",
          contextTokens: 1000,
          charsPerToken: 4,
          safetyMarginTokens: 100
        }),
        { httpFetch: async () => new Response(), logger: createTestLogger() }
      );
      expect(provider.canFit("a".repeat(2000), 1600)).toBe(true);
      expect(provider.canFit("a".repeat(2000), 1601)).toBe(false);
    });
  });
});
