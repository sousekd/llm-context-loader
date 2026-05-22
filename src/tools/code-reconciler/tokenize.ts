// Small language-agnostic tokenizer for code-block similarity primitives.
// Callers can supply richer tokenizers to scored matchers when a pipeline needs one.

export interface TokenizeCodeWordsOptions {
  readonly lowercase?: boolean;
}

/** Extract identifier-like and number-like tokens from code text. */
export function tokenizeCodeWords(code: string, options: TokenizeCodeWordsOptions = {}): readonly string[] {
  const lowercase = options.lowercase ?? true;
  const matches = code.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?/g) ?? [];
  return lowercase ? matches.map((token) => token.toLowerCase()) : matches;
}
