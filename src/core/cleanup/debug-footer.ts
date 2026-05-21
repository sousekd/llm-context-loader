// Diagnostic-footer contracts and rendering helpers used by the orchestration flow.
// XML attribute escaping security boundary is enforced by `escapeAttr` in this module.

export type FooterReturned = "clean" | "summary" | "source" | "truncated" | "error";

export interface FetchFooter {
  status: string;
  durationMs: number;
  chars: number;
}

export type StageStatus =
  | "cleaned"
  | "summarized"
  | "skipped_disabled"
  | "skipped_short"
  | "skipped_too_long"
  | "timeout"
  | "llm_failed"
  | "quality_rejected";

export interface StageFooter {
  status: StageStatus;
  durationMs: number;
  inputChars: number;
  outputChars?: number;
  ratio?: number;
  reason?: string;
  model?: string;
}

export interface TruncateFooter {
  applied: boolean;
  originalChars: number;
  outputChars: number;
}

export interface FooterInfo {
  returned: FooterReturned;
  sourceUrl: string;
  title?: string;
  finalChars: number;
  fetchProvider: string;
  llmProvider?: string;
  fetch: FetchFooter;
  stages: {
    clean?: StageFooter;
    summarize?: StageFooter;
    truncate?: TruncateFooter;
  };
  error?: string;
}

/** Escape values for XML attribute contexts without double-encoding entities. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Normalize a scalar value into an escaped XML-attribute string. */
function attr(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return escapeAttr(trimmed);
}

/** Format ratio values for stable footer output. */
function ratioAttr(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value.toFixed(3);
}

/** Build the snake_case template variable bag from footer info. */
export function footerVariables(info: FooterInfo): Record<string, unknown> {
  const view: Record<string, unknown> = {
    returned: attr(info.returned),
    source_url: attr(info.sourceUrl),
    title: attr(info.title),
    final_chars: info.finalChars,
    fetch_provider: attr(info.fetchProvider),
    llm_provider: attr(info.llmProvider),
    fetch_status: attr(info.fetch.status),
    fetch_duration_ms: info.fetch.durationMs,
    fetch_chars: info.fetch.chars,
    error: attr(info.error)
  };

  const clean = info.stages.clean;
  if (clean) {
    view.clean_status = attr(clean.status);
    view.clean_duration_ms = clean.durationMs;
    view.clean_input_chars = clean.inputChars;
    view.clean_output_chars = clean.outputChars;
    view.clean_ratio = ratioAttr(clean.ratio);
    view.clean_reason = attr(clean.reason);
    view.clean_model = attr(clean.model);
  }

  const summarize = info.stages.summarize;
  if (summarize) {
    view.summarize_status = attr(summarize.status);
    view.summarize_duration_ms = summarize.durationMs;
    view.summarize_input_chars = summarize.inputChars;
    view.summarize_output_chars = summarize.outputChars;
    view.summarize_ratio = ratioAttr(summarize.ratio);
    view.summarize_reason = attr(summarize.reason);
    view.summarize_model = attr(summarize.model);
  }

  const truncate = info.stages.truncate;
  if (truncate) {
    view.truncate_status = truncate.applied ? "truncated" : "intact";
    view.truncate_original_chars = truncate.originalChars;
    view.truncate_output_chars = truncate.outputChars;
  }

  return view;
}

/** Append rendered footer text to a markdown body. */
export function appendFooter(body: string, footer: string): string {
  const trimmedBody = body.replace(/\s+$/, "");
  const trimmedFooter = footer.trim();
  if (!trimmedFooter) return trimmedBody;
  return `${trimmedBody}\n\n${trimmedFooter}\n`;
}
