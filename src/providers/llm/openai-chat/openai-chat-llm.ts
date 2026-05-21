import type { AppConfig } from "../../../config/config.js";
import type {
  LlmChatOptions,
  LlmChatResult,
  LlmMessage,
  LlmProvider
} from "../../../core/ports/llm-provider.js";

import { AppError } from "../../../core/util/errors.js";
import { joinUrl } from "../../../core/util/urls.js";

// OpenAI-compatible chat-completions implementation for the LLM port.
// Handles untrusted external content at the response parsing security boundary.

const DEFAULT_TIMEOUT_MS = 60_000;

/** Slugify upstream error codes before interpolating them in AppError codes. */
function sanitizeUpstreamCode(value: unknown): string {
  if (value === undefined || value === null) return "unknown";
  const slug = String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "unknown";
}

export type FetchFn = typeof fetch;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string | number;
    type?: string;
  };
}

export interface OpenAiChatLlmProviderOptions {
  fetchFn?: FetchFn;
}

export class OpenAiChatLlmProvider implements LlmProvider {
  readonly name = "openai_chat";
  private readonly fetchFn: FetchFn;

  /** Create an OpenAI-compatible provider for chat-completions requests. */
  constructor(
    private readonly config: AppConfig,
    options: OpenAiChatLlmProviderOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /** Execute one chat request and return normalized model text output. */
  async chat(messages: LlmMessage[], options: LlmChatOptions = {}): Promise<LlmChatResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (this.config.LLM_API_KEY) {
        headers.authorization = `Bearer ${this.config.LLM_API_KEY}`;
      }

      const body = {
        model: this.config.LLM_MODEL,
        messages,
        ...this.config.LLM_EXTRA_BODY
      };

      const response = await this.fetchFn(joinUrl(this.config.LLM_BASE_URL, "/chat/completions"), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      let payload: ChatCompletionResponse;
      try {
        payload = JSON.parse(text) as ChatCompletionResponse;
      } catch {
        throw new AppError(`LLM returned non-JSON response: ${text.slice(0, 300)}`, "llm_non_json", 502);
      }

      if (!response.ok) {
        throw new AppError(
          payload.error?.message || `LLM request failed with HTTP ${response.status}`,
          payload.error?.code !== undefined ? `llm_${sanitizeUpstreamCode(payload.error.code)}` : "llm_http_error",
          502,
          payload
        );
      }

      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        throw new AppError("LLM response did not contain choices[0].message.content", "llm_missing_content", 502, payload);
      }

      return {
        text: content,
        model: this.config.LLM_MODEL,
        providerMetadata: { usage: payload.usage }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("LLM request timed out", "llm_timeout", 504);
      }
      throw new AppError(error instanceof Error ? error.message : String(error), "llm_request_failed", 502, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
