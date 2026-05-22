import type { CodeFingerprint, NormalizeCodeOptions } from "./types.js";

import { normalizeCodeForComparison, splitCodeLines } from "./normalize.js";
import { tokenizeCodeWords } from "./tokenize.js";

// Code-block fingerprinting for cheap pre-comparison facts.
// Hashes are comparison hints only; repair output always comes from trusted raw blocks.

export interface CodeFingerprintOptions extends NormalizeCodeOptions {
  readonly tokenize?: (code: string) => Iterable<string>;
}

/** Build fingerprint facts for a code block using the supplied normalization options. */
export function createCodeFingerprint(code: string, options: CodeFingerprintOptions = {}): CodeFingerprint {
  const normalized = normalizeCodeForComparison(code, options);
  const lines = splitCodeLines(normalized);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const tokenize = options.tokenize ?? tokenizeCodeWords;

  return {
    lineCount: lines.length,
    nonEmptyLineCount: nonEmptyLines.length,
    charCount: normalized.length,
    firstNonEmptyLine: nonEmptyLines[0],
    lastNonEmptyLine: nonEmptyLines.at(-1),
    normalizedLineHashes: lines.map(fnv1a32),
    tokenSet: new Set(tokenize(normalized))
  };
}

/** Hash one line into an eight-character FNV-1a hex string. */
function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
