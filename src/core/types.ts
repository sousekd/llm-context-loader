import type { FetchFooter, FooterReturned, StageFooter, TruncateFooter } from "./cleanup/debug-footer.js";

// Shared domain contracts exchanged between use-cases, clients, and providers.
// Metadata mirrors the diagnostic footer so JSON and footer stay consistent.

export interface ContextDocument {
  /** Final markdown body returned to the client. */
  pageContent: string;

  /** Structured diagnostics and provenance metadata for the body. */
  metadata: ContextMetadata;
}

export interface ContextMetadata {
  /** Normalized source URL. */
  source: string;

  /** Optional title extracted by the fetch provider. */
  title?: string;

  /** Fixed loader identifier for downstream consumers. */
  loader: "llm-context-loader";

  /** Fetch provider identifier. */
  fetchProvider: string;

  /** LLM provider identifier when stages are configured. */
  llmProvider?: string;

  /** Which content branch produced the final output. */
  returned: FooterReturned;

  /** Final output size in characters. */
  finalChars: number;

  /** Fetch-stage diagnostics. */
  fetch: FetchFooter;

  /** Optional diagnostics for each processing stage. */
  stages: {
    clean?: StageFooter;
    summarize?: StageFooter;
    truncate?: TruncateFooter;
  };

  /** Optional fetch-failure message when diagnostic mode is enabled. */
  error?: string;
}

export interface FetchedDocument {
  /** Normalized source URL returned by the provider. */
  url: string;

  /** Optional title extracted from upstream metadata. */
  title?: string;

  /** Raw markdown returned by the fetch provider. */
  markdown: string;

  /** Optional upstream HTTP status code. */
  statusCode?: number;

  /** Optional upstream content-type value. */
  contentType?: string;

  /** Provider-specific metadata payload forwarded for diagnostics. */
  providerMetadata?: Record<string, unknown>;
}
