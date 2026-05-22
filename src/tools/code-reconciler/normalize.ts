import type { NormalizeCodeOptions } from "./types.js";

// Code-text normalization for comparison keys only.
// Normalized strings are never repair output; trusted raw blocks remain byte-for-byte source.

const LANGUAGE_ALIASES = new Map([
  ["bash", "shell"],
  ["c++", "cpp"],
  ["c#", "csharp"],
  ["cs", "csharp"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["md", "markdown"],
  ["mjs", "javascript"],
  ["ps1", "powershell"],
  ["py", "python"],
  ["sh", "shell"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["yml", "yaml"],
  ["zsh", "shell"]
]);

/** Normalize code text into a comparison key. */
export function normalizeCodeForComparison(code: string, options: NormalizeCodeOptions = {}): string {
  let normalized = options.lineEndings === "preserve" ? code : code.replace(/\r\n?/g, "\n");
  if (options.trimTrailingLineWs === true) normalized = normalized.replace(/[ \t]+(?=\n|$)/g, "");
  if (options.collapseIndentedBlankLines === true) normalized = normalized.replace(/^[ \t]+$/gm, "");
  if (options.trimFinalNewline === true) normalized = normalized.replace(/(?:\r\n|\r|\n)+$/, "");
  return normalized;
}

/** Normalize a markdown info-string language token. */
export function normalizeLanguageAlias(language: string): string | undefined {
  const normalized = language.trim().replace(/^\./, "").toLowerCase();
  if (normalized.length === 0) return undefined;
  return LANGUAGE_ALIASES.get(normalized) ?? normalized;
}

/** Split code into logical lines with line endings normalized to LF. */
export function splitCodeLines(code: string): readonly string[] {
  if (code.length === 0) return [];

  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
