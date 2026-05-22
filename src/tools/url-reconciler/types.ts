// Shared data shapes for URL reconciliation primitives.
// Types carry spans and trusted raw URL strings; callers own all policy decisions.

export type ExtractedMarkdownUrlKind = "inline" | "image" | "reference_definition" | "autolink" | "bare";

export interface ExtractUrlsOptions {
  readonly includeBareUrls?: boolean;
  readonly includeImages?: boolean;
  readonly includeReferenceDefinitions?: boolean;
}

export interface ExtractedMarkdownUrl {
  readonly id: string;
  readonly kind: ExtractedMarkdownUrlKind;
  readonly rawUrl: string;
  readonly rawMatch: string;
  readonly start: number;
  readonly end: number;
  readonly urlStart: number;
  readonly urlEnd: number;
  readonly text?: string;
  readonly occurrenceIndex: number;
}

export interface NormalizeUrlsOptions {
  readonly allowedSchemes?: readonly string[];
  readonly baseUrl?: string;
}

export interface NormalizedUrl {
  readonly kind: "url";
  readonly rawUrl: string;
  readonly href: string;
  readonly hrefKey: string;
  readonly strictKey: string;
  readonly fetchKey: string;
  readonly scheme: string;
  readonly host: string;
  readonly path: string;
  readonly search: string;
  readonly queryKey: string;
  readonly fragment: string;
}

export interface UrlParseFailure {
  readonly kind: "parse_failure";
  readonly rawUrl: string;
  readonly normalizedInput: string;
  readonly reason: "empty" | "invalid" | "unsupported_scheme";
  readonly scheme?: string;
}

export interface TrustedUrlRecord {
  readonly extracted: ExtractedMarkdownUrl;
  readonly rawUrl: string;
  readonly text?: string;
  readonly normalized: NormalizedUrl;
}

export interface TrustedUrlInventory {
  /** Look up records by the exact raw URL substring from trusted markdown. */
  lookupRaw(rawUrl: string): readonly TrustedUrlRecord[];

  /** Look up records by the strict normalized URL key, including fragment. */
  lookupStrict(strictKey: string): readonly TrustedUrlRecord[];

  /** Look up records by the fetch normalized URL key, excluding fragment. */
  lookupFetch(fetchKey: string): readonly TrustedUrlRecord[];

  /** Look up records by normalized anchor text. */
  lookupAnchorText(text: string): readonly TrustedUrlRecord[];

  /** Look up records by normalized path, with slash variants handled by the inventory. */
  lookupByHostPath(path: string): readonly TrustedUrlRecord[];

  /**
    * Return every unique trusted URL record in first-seen order. Repeated raw URLs may still
    * contribute additional lookup metadata such as anchor text.
    */
  allRecords(): readonly TrustedUrlRecord[];
}

