import type { ContextDocument, ContextMetadata } from "../../core/types.js";

// OpenWebUI response adapter from internal context documents to loader contract.
// Converts camelCase metadata fields into expected snake_case keys.

export interface OpenWebUiDocument {
  page_content: string;
  metadata: Record<string, unknown>;
}

/** Convert internal context documents to OpenWebUI document rows. */
export function toOpenWebUiDocuments(documents: ContextDocument[]): OpenWebUiDocument[] {
  return documents.map((document) => ({
    page_content: document.pageContent,
    metadata: toOpenWebUiMetadata(document.metadata)
  }));
}

/** Convert internal metadata shape to OpenWebUI snake_case metadata keys. */
function toOpenWebUiMetadata(metadata: ContextMetadata): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: metadata.source,
    title: metadata.title,
    loader: metadata.loader,
    fetch_provider: metadata.fetchProvider,
    llm_provider: metadata.llmProvider,
    returned: metadata.returned,
    final_chars: metadata.finalChars,
    fetch_status: metadata.fetch.status,
    fetch_duration_ms: metadata.fetch.durationMs,
    fetch_chars: metadata.fetch.chars,
    error: metadata.error
  };

  const clean = metadata.stages.clean;
  if (clean) {
    out.clean_status = clean.status;
    out.clean_duration_ms = clean.durationMs;
    out.clean_input_chars = clean.inputChars;
    out.clean_output_chars = clean.outputChars;
    out.clean_ratio = clean.ratio;
    out.clean_reason = clean.reason;
    out.clean_model = clean.model;
  }

  const summarize = metadata.stages.summarize;
  if (summarize) {
    out.summarize_status = summarize.status;
    out.summarize_duration_ms = summarize.durationMs;
    out.summarize_input_chars = summarize.inputChars;
    out.summarize_output_chars = summarize.outputChars;
    out.summarize_ratio = summarize.ratio;
    out.summarize_reason = summarize.reason;
    out.summarize_model = summarize.model;
  }

  const truncate = metadata.stages.truncate;
  if (truncate) {
    out.truncate_applied = truncate.applied;
    out.truncate_original_chars = truncate.originalChars;
    out.truncate_output_chars = truncate.outputChars;
  }

  return out;
}
