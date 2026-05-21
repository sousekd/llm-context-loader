// LLM port consumed by stage orchestration in core use-cases.
// Implementations issue one chat-shaped request and return text plus metadata.

export interface LlmMessage {
  /** Chat role accepted by the provider wire format. */
  role: "system" | "user";

  /** Message content sent to the provider. */
  content: string;
}

export interface LlmChatOptions {
  /** Max output tokens budget for the request. */
  maxTokens?: number;

  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

export interface LlmChatResult {
  /** Model output text. */
  text: string;

  /** Model identifier reported by the provider. */
  model: string;

  /** Provider-specific metadata forwarded for diagnostics. */
  providerMetadata?: Record<string, unknown>;
}

export interface LlmProvider {
  /** Human-readable provider identifier used in diagnostics. */
  readonly name: string;

  /** Send one chat-completions request and return normalized output. */
  chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult>;
}
