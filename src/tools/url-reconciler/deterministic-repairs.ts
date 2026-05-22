import { decodeCommonHtmlEntities } from "./normalize.js";

// Deterministic URL string repair candidates for reconciliation matchers.
// Produces candidate strings only; callers decide whether any candidate is usable.

const DEFAULT_MAX_DEPTH = 4;

export interface DeterministicRepairOptions {
  /**
   * Maximum number of transform layers to expand. Empirically sufficient for one-off
   * LLM corruptions; raise for chained corruption, lower for speed. Default: 4.
   */
  readonly maxDepth?: number;
}

/** Generate deduplicated deterministic URL candidates from one raw URL string. */
export function generateDeterministicUrlCandidates(rawUrl: string, options: DeterministicRepairOptions = {}): string[] {
  const maxDepth = normalizeMaxDepth(options.maxDepth);
  const candidates = new Set<string>([rawUrl]);
  let frontier = [rawUrl];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const value of frontier) {
      for (const transformed of transforms(value)) {
        if (!candidates.has(transformed)) {
          candidates.add(transformed);
          next.push(transformed);
        }
      }
    }
    frontier = next;
  }

  return [...candidates];
}

/** Normalize caller-supplied expansion depth into a finite non-negative integer. */
function normalizeMaxDepth(maxDepth: number | undefined): number {
  const value = maxDepth ?? DEFAULT_MAX_DEPTH;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Apply one layer of deterministic string transforms. */
function transforms(value: string): string[] {
  return [
    decodeCommonHtmlEntities(value),
    value.replace(/\\\//g, "/"),
    stripMatchingWrapper(value),
    value.replace(/\\([()[\]<>*_`])/g, "$1"),
    trimTrailingPunctuation(value),
    value.replace(/\s+/g, "").trim()
  ].filter((candidate) => candidate.length > 0);
}

/** Strip one matching wrapper pair from a URL-like string. */
function stripMatchingWrapper(value: string): string {
  const trimmed = value.trim();
  const pairs = [
    ["<", ">"],
    ['"', '"'],
    ["'", "'"],
    ["`", "`"]
  ] as const;

  for (const [open, close] of pairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close) && trimmed.length >= open.length + close.length) {
      return trimmed.slice(open.length, -close.length);
    }
  }

  return trimmed;
}

/** Trim prose punctuation while preserving balanced closing parentheses. */
function trimTrailingPunctuation(value: string): string {
  let output = value.trim();
  while (/[.,;:!?\]]$/.test(output)) output = output.slice(0, -1);
  while (output.endsWith(")") && count(output, "(") < count(output, ")")) output = output.slice(0, -1);
  return output;
}

/** Count occurrences of one character. */
function count(value: string, character: string): number {
  let total = 0;
  for (const current of value) {
    if (current === character) total += 1;
  }
  return total;
}
