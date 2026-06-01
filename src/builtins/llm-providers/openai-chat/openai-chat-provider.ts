/**
 * Implements a lowest-common-denominator OpenAI-compatible chat provider.
 *
 * Provider responses are untrusted external content. Upstream HTTP, JSON parse,
 * response-shape, empty-response, and network failures are translated to
 * `UpstreamError`; its constructor owns the sanitizeUpstreamCode security
 * boundary before failures reach step diagnostics or logs.
 */

import { z } from "zod";

import { UpstreamError, isAbortError } from "../../../shared/errors.js";
import { joinUrl } from "../../../shared/urls.js";

import type { LlmChatResult, LlmMessage, LlmProvider } from "../../../contracts/extensions/llm-provider.js";
import type { Logger } from "../../../shared/logger.js";
import type { OpenAiChatConfig } from "./openai-chat-provider-config.js";

const chatResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().nullable().optional() }).passthrough().optional(),
            text: z.string().optional()
          })
          .passthrough()
      )
      .min(1)
  })
  .passthrough();

const chatErrorResponseSchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        code: z.unknown().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

/** Implements the OpenAI-compatible Chat Completions LLM provider. */
export class OpenAiChatProvider implements LlmProvider {
  /** Creates an OpenAI-compatible chat provider. */
  constructor(
    private readonly config: OpenAiChatConfig,
    private readonly deps: { readonly httpFetch: typeof globalThis.fetch; readonly logger: Logger }
  ) {}

  /** Sends a basic Chat Completions request and returns the first text response. */
  async chat(messages: ReadonlyArray<LlmMessage>, opts: { readonly signal: AbortSignal }): Promise<LlmChatResult> {
    try {
      const response = await this.deps.httpFetch(joinUrl(this.config.baseUrl, "/chat/completions"), {
        method: "POST",
        signal: opts.signal,
        headers: this.headers(),
        body: JSON.stringify({ model: this.config.model, messages, ...this.config.extraBody })
      });

      const raw: unknown = await response.json().catch((error: unknown) => {
        if (isAbortError(error)) throw error;
        throw new UpstreamError("LLM response was not valid JSON", "parse_error", {
          upstreamStatus: response.status,
          cause: error
        });
      });
      if (!response.ok) {
        const errorPayload = chatErrorResponseSchema.safeParse(raw);
        const upstreamCode = errorPayload.success ? errorPayload.data.error?.code : undefined;
        const message = errorPayload.success ? errorPayload.data.error?.message : undefined;
        throw new UpstreamError(
          message ?? `LLM returned HTTP ${response.status}`,
          upstreamCode ?? `http_${response.status}`,
          {
            upstreamStatus: response.status,
            cause: raw
          }
        );
      }
      const parsed = chatResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new UpstreamError("LLM response shape was not recognized", "parse_error", {
          upstreamStatus: response.status,
          cause: parsed.error.flatten()
        });
      const choice = parsed.data.choices[0];
      const text = choice.message?.content ?? choice.text ?? "";
      if (!text)
        throw new UpstreamError("LLM response did not include text", "empty_response", {
          upstreamStatus: response.status
        });
      return { text };
    } catch (error) {
      if (error instanceof UpstreamError || isAbortError(error)) throw error;
      throw new UpstreamError(error instanceof Error ? error.message : String(error), "network", { cause: error });
    }
  }

  /** Reports whether prompt plus reserved output fits the configured context window. */
  canFit(prompt: string, outputReserveChars: number): boolean {
    if (this.config.contextTokens === undefined) return true;
    const reserveChars = Math.max(0, outputReserveChars);
    const promptTokens = Math.ceil(prompt.length / this.config.charsPerToken);
    const reserveTokens = Math.ceil(reserveChars / this.config.charsPerToken);
    return promptTokens + reserveTokens + this.config.safetyMarginTokens <= this.config.contextTokens;
  }

  /** Builds request headers for the upstream chat endpoint. */
  private headers(): HeadersInit {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }
}
