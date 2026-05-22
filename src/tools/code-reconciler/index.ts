export { boundarySimilarity } from "./boundary-similarity.js";
export { extractMarkdownCodeBlocks } from "./extract.js";
export { createCodeFingerprint } from "./fingerprint.js";
export type { CodeFingerprintOptions } from "./fingerprint.js";
export { buildTrustedCodeBlockInventory } from "./inventory.js";
export { lengthRatioSimilarity } from "./length-ratio-similarity.js";
export type { LengthRatioSimilarityOptions } from "./length-ratio-similarity.js";
export { lineLcsSimilarity } from "./line-lcs-similarity.js";
export { matchByNormalizedCode } from "./match-normalized-code.js";
export type { NormalizedCodeMatchOptions } from "./match-normalized-code.js";
export { matchByRawBlock } from "./match-raw-block.js";
export type { RawBlockMatchOptions } from "./match-raw-block.js";
export { matchByRawCode } from "./match-raw-code.js";
export type { RawCodeMatchOptions } from "./match-raw-code.js";
export { normalizeCodeForComparison, normalizeLanguageAlias, splitCodeLines } from "./normalize.js";
export { tokenJaccardSimilarity } from "./token-jaccard-similarity.js";
export type { TokenJaccardSimilarityOptions } from "./token-jaccard-similarity.js";
export { tokenizeCodeWords } from "./tokenize.js";
export type { TokenizeCodeWordsOptions } from "./tokenize.js";
export type {
  CodeFingerprint,
  ExtractedMarkdownCodeBlock,
  MarkdownCodeBlockKind,
  NormalizeCodeOptions,
  TrustedCodeBlockInventory,
  TrustedCodeBlockRecord
} from "./types.js";
