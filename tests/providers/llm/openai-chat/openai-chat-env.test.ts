import { describe, expect, it } from "vitest";

import { parseOpenAiChatEnv } from "../../../../src/providers/llm/openai-chat/openai-chat-env.js";

describe("parseOpenAiChatEnv", () => {
  it("returns an empty provider-specific config", () => {
    expect(parseOpenAiChatEnv({ LLM_API_KEY: "shared-key" } as NodeJS.ProcessEnv)).toEqual({});
  });
});