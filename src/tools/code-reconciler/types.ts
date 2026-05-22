// Shared data shapes for markdown code-block reconciliation primitives.
// Types carry spans and trusted raw code blocks; callers own all policy decisions.

export type MarkdownCodeBlockKind = "fenced_backtick" | "fenced_tilde";

export interface ExtractedMarkdownCodeBlock {
  readonly id: string;
  readonly kind: MarkdownCodeBlockKind;
  readonly rawBlock: string;
  readonly rawCode: string;
  readonly rawInfo?: string;
  readonly language?: string;
  readonly start: number;
  readonly end: number;
  readonly codeStart: number;
  readonly codeEnd: number;
  readonly occurrenceIndex: number;
}

export interface NormalizeCodeOptions {
  readonly collapseIndentedBlankLines?: boolean;
  readonly lineEndings?: "lf" | "preserve";
  readonly trimFinalNewline?: boolean;
  readonly trimTrailingLineWs?: boolean;
}

export interface CodeFingerprint {
  readonly lineCount: number;
  readonly nonEmptyLineCount: number;
  readonly charCount: number;
  readonly firstNonEmptyLine?: string;
  readonly lastNonEmptyLine?: string;
  readonly normalizedLineHashes: readonly string[];
  readonly tokenSet: ReadonlySet<string>;
}

export interface TrustedCodeBlockRecord {
  readonly extracted: ExtractedMarkdownCodeBlock;
  readonly language?: string;
  readonly normalizedCodeKey: string;
}

export interface TrustedCodeBlockInventory {
  /** Look up records by the exact raw fenced block from trusted markdown. */
  lookupRawBlock(rawBlock: string): readonly TrustedCodeBlockRecord[];

  /** Look up records by the exact raw code body from trusted markdown. */
  lookupRawCode(rawCode: string): readonly TrustedCodeBlockRecord[];

  /** Look up records by normalized code body. */
  lookupNormalizedCode(normalizedCodeKey: string): readonly TrustedCodeBlockRecord[];

  /** Look up records by normalized language token. */
  lookupByLanguage(language: string): readonly TrustedCodeBlockRecord[];

  /**
    * Return every unique trusted code-block record in first-seen order. Duplicate raw fenced
    * blocks are represented by their first occurrence.
    */
  allRecords(): readonly TrustedCodeBlockRecord[];
}
