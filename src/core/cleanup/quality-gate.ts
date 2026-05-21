import { compactChars } from "./length-policy.js";

// Post-stage quality checks that keep regressions from replacing prior output.
// Rejected stage output falls back to previous content with an explicit reason.

export type QualityRejectReason = "empty" | "ineffective" | "unexpected_urls" | "too_small_ratio";

export interface QualityOptions {
  /** Minimum allowed compacted-char ratio: output/source. */
  minRatio: number;

  /** Whether output may introduce URLs absent from the source. */
  checkUrls: boolean;
}

export interface QualityAssessment {
  ok: boolean;
  reason?: QualityRejectReason;
  sourceChars: number;
  outputChars: number;
  ratio: number;
  sourceUrlCount: number;
  outputUrlCount: number;
  unexpectedUrls: string[];
}

const URL_REGEX = /\bhttps?:\/\/[^\s)>\]]+/gi;

/** Normalize URL-like matches by trimming trailing prose punctuation. */
function normalizeMatchedUrl(url: string): string {
  return url.replace(/[).,;!?]+$/, "");
}

/** Extract normalized HTTP(S) URLs from free-form text. */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return matches.map(normalizeMatchedUrl);
}

/** Assess stage output quality against deterministic compaction and URL checks. */
export function assessQuality(source: string, output: string, opts: QualityOptions): QualityAssessment {
  const sourceChars = compactChars(source);
  const outputChars = compactChars(output);
  const ratio = sourceChars > 0 ? outputChars / sourceChars : 0;

  const sourceUrls = new Set(extractUrls(source));
  const outputUrls = extractUrls(output);
  const unexpectedUrls = opts.checkUrls
    ? Array.from(new Set(outputUrls.filter((url) => !sourceUrls.has(url))))
    : [];

  const base: QualityAssessment = {
    ok: true,
    sourceChars,
    outputChars,
    ratio,
    sourceUrlCount: sourceUrls.size,
    outputUrlCount: outputUrls.length,
    unexpectedUrls
  };

  if (outputChars === 0) return { ...base, ok: false, reason: "empty" };
  if (opts.checkUrls && unexpectedUrls.length > 0) return { ...base, ok: false, reason: "unexpected_urls" };
  if (sourceChars > 0 && outputChars >= sourceChars) return { ...base, ok: false, reason: "ineffective" };
  if (sourceChars > 0 && ratio < opts.minRatio) return { ...base, ok: false, reason: "too_small_ratio" };

  return base;
}
