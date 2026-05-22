import { jaccardSimilarity } from "../shared/jaccard.js";
import { tokenizeCodeWords } from "./tokenize.js";

// Token-set Jaccard similarity for code-block scoring.
// Callers may supply a tokenizer; the default is intentionally language-agnostic.

export interface TokenJaccardSimilarityOptions {
  readonly tokenize?: (code: string) => Iterable<string>;
}

/** Return token-set Jaccard similarity in the inclusive range [0, 1]. */
export function tokenJaccardSimilarity(leftCode: string, rightCode: string, options: TokenJaccardSimilarityOptions = {}): number {
  const tokenize = options.tokenize ?? tokenizeCodeWords;
  return jaccardSimilarity(tokenize(leftCode), tokenize(rightCode));
}
