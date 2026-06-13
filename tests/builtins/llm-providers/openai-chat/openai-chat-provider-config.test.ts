/** Verifies OpenAI-compatible chat provider configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseOpenAiChatConfig } from "../../../../src/builtins/llm-providers/openai-chat/openai-chat-provider-config.js";

describe("parseOpenAiChatConfig", () => {
  it("treats blank context-fit fields as omitted/defaulted", () => {
    const config = parseOpenAiChatConfig({
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      contextTokens: "",
      charsPerToken: "",
      safetyMarginTokens: ""
    });

    expect(config).toMatchObject({ charsPerToken: 3.5, safetyMarginTokens: 0 });
    expect(config.contextTokens).toBeUndefined();
  });

  it("coerces numeric strings", () => {
    expect(
      parseOpenAiChatConfig({
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        contextTokens: "128000",
        charsPerToken: "4",
        safetyMarginTokens: "128"
      })
    ).toMatchObject({ contextTokens: 128000, charsPerToken: 4, safetyMarginTokens: 128 });
  });

  it("rejects invalid context-fit values", () => {
    expect(() =>
      parseOpenAiChatConfig({ baseUrl: "https://llm.example/v1", model: "test-model", contextTokens: "0" })
    ).toThrow();
  });

  it("passes through inline extraBody object unmodified", () => {
    const config = parseOpenAiChatConfig({
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      extraBody: { temperature: 0.7, top_p: 0.9 }
    });
    expect(config.extraBody).toEqual({ temperature: 0.7, top_p: 0.9 });
  });

  it("parses a JSON-string blob in extraBody from a single env var", () => {
    const config = parseOpenAiChatConfig({
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      extraBody: '{"temperature":0.7,"top_p":0.9}'
    });
    expect(config.extraBody).toEqual({ temperature: 0.7, top_p: 0.9 });
  });

  it("coerces a blank extraBody env var to empty object", () => {
    const config = parseOpenAiChatConfig({
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      extraBody: ""
    });
    expect(config.extraBody).toEqual({});
  });

  it("rejects invalid JSON in extraBody", () => {
    expect(() =>
      parseOpenAiChatConfig({
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        extraBody: "{bad"
      })
    ).toThrow();
  });
});
