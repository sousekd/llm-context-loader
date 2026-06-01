/**
 * Extracts and canonicalizes HTTP(S) URLs from markdown bodies.
 *
 * WHATWG `URL` is the security boundary for untrusted external content. Only
 * absolute `http:` and `https:` URLs survive canonicalization; relative links,
 * non-web schemes, and malformed values are dropped. The extractor recognizes
 * inline links, autolinks, and bare HTTP(S) runs while excluding fenced code,
 * inline code, image links, and reference definitions so URL verification can
 * compare user-visible text links rather than markdown implementation details.
 */

const BARE_URL = /\bhttps?:\/\/[^\s<>`'")]+/gi;
const AUTOLINK = /<(https?:\/\/[^\s<>]+)>/gi;
const INLINE_LINK_OPEN = /\[/g;
const TRAILING_PUNCTUATION = /[).,;:!?'"]+$/;

/** Extracts URL strings from markdown, skipping fenced and inline code spans. */
export function extractMarkdownUrls(markdown: string): string[] {
  const codeExcluded = mergeRanges([...fencedCodeRanges(markdown), ...inlineCodeRanges(markdown)]);
  const skippedConstructs: Range[] = [];
  skippedConstructs.push(...imageLinkRanges(markdown, codeExcluded));
  skippedConstructs.push(...referenceDefinitionRanges(markdown, codeExcluded));
  const excluded = mergeRanges([...codeExcluded, ...skippedConstructs]);

  const found: UrlMatch[] = [];
  collectInlineLinks(markdown, excluded, found);
  collectAutolinks(markdown, excluded, found);
  collectBareUrls(markdown, excluded, found);

  found.sort((left, right) => left.start - right.start || left.end - right.end);
  const claimed: { start: number; end: number }[] = [];
  const results: string[] = [];
  for (const match of found) {
    if (overlapsAny(match, claimed)) continue;
    claimed.push(match);
    results.push(match.url);
  }
  return results;
}

/** Canonicalizes a URL string for cross-document comparison; returns undefined when unusable. */
export function canonicalizeUrl(raw: string): string | undefined {
  const trimmed = decodeCommonHtmlEntities(raw).trim();
  if (trimmed.length === 0) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  const sortedSearch = sortedQueryString(parsed.searchParams);
  parsed.search = sortedSearch;
  return parsed.toString();
}

/** Extracts and canonicalizes URLs from markdown into a deduplicated set. */
export function collectCanonicalUrls(markdown: string): Set<string> {
  return new Set(collectCanonicalUrlCounts(markdown).keys());
}

/** Extracts canonical URLs from markdown and counts how often each appears. */
export function collectCanonicalUrlCounts(markdown: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of extractMarkdownUrls(markdown)) {
    const canonical = canonicalizeUrl(raw);
    if (!canonical) continue;
    counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
  }
  return counts;
}

/** Describes a half-open character range in the original markdown string. */
interface Range {
  readonly start: number;
  readonly end: number;
}

/** Pairs an extracted URL string with its span in the original markdown string. */
interface UrlMatch {
  readonly url: string;
  readonly start: number;
  readonly end: number;
}

/** Finds fenced code blocks that should not contribute URLs. */
function fencedCodeRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const fence = /^( {0,3})(`{3,}|~{3,})[^\n\r]*(?:\r?\n|$)/gm;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(markdown)) !== null) {
    const marker = match[2][0];
    const size = match[2].length;
    const close = new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${size},}[ \\t]*(?:\\r?\\n|$)`, "gm");
    close.lastIndex = fence.lastIndex;
    const closeMatch = close.exec(markdown);
    ranges.push({ start: match.index, end: closeMatch ? close.lastIndex : markdown.length });
    fence.lastIndex = closeMatch ? close.lastIndex : markdown.length;
  }
  return ranges;
}

/** Finds inline code spans that should not contribute URLs. */
function inlineCodeRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const inline = /(`+)(?:[^`\r\n]|`(?!`))*?\1/g;
  let match: RegExpExecArray | null;
  while ((match = inline.exec(markdown)) !== null) ranges.push({ start: match.index, end: inline.lastIndex });
  return ranges;
}

/** Merges overlapping or touching ranges into sorted half-open ranges. */
function mergeRanges(input: ReadonlyArray<Range>): Range[] {
  if (input.length === 0) return [];
  const sorted = [...input].sort((left, right) => left.start - right.start);
  const merged: Range[] = [{ ...sorted[0]! }];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = merged[merged.length - 1]!;
    const next = sorted[index]!;
    if (next.start <= previous.end) {
      if (next.end > previous.end) merged[merged.length - 1] = { start: previous.start, end: next.end };
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

/** Returns whether a position falls inside one of the excluded ranges. */
function isInRanges(position: number, ranges: ReadonlyArray<Range>): boolean {
  for (const range of ranges) if (position >= range.start && position < range.end) return true;
  return false;
}

/** Returns whether a candidate range overlaps a previously claimed match. */
function overlapsAny(candidate: Range, claimed: ReadonlyArray<Range>): boolean {
  for (const existing of claimed) if (candidate.start < existing.end && candidate.end > existing.start) return true;
  return false;
}

/** Collects markdown inline link destinations while skipping excluded ranges. */
function collectInlineLinks(markdown: string, excluded: ReadonlyArray<Range>, found: UrlMatch[]): void {
  INLINE_LINK_OPEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_LINK_OPEN.exec(markdown)) !== null) {
    const openBracket = match.index;
    if (isInRanges(openBracket, excluded)) continue;
    const image = openBracket > 0 && markdown[openBracket - 1] === "!";
    if (image) continue;
    const closeBracket = markdown.indexOf("](", openBracket);
    if (closeBracket === -1) break;
    const text = markdown.slice(openBracket + 1, closeBracket);
    if (text.includes("\n") || text.includes("\r") || text.includes("[")) continue;
    const destinationStart = closeBracket + 2;
    const parsed = readMarkdownDestination(markdown, destinationStart);
    if (!parsed) continue;
    if (isInRanges(parsed.urlStart, excluded)) continue;
    found.push({ url: parsed.url, start: openBracket, end: parsed.end });
    INLINE_LINK_OPEN.lastIndex = parsed.end;
  }
}

/** Finds image links so their destinations do not also appear as bare URLs. */
function imageLinkRanges(markdown: string, codeExcluded: ReadonlyArray<Range>): Range[] {
  const ranges: Range[] = [];
  const open = /!\[/g;
  let match: RegExpExecArray | null;
  while ((match = open.exec(markdown)) !== null) {
    const start = match.index;
    if (isInRanges(start, codeExcluded)) continue;
    const closeBracket = markdown.indexOf("](", start + 2);
    if (closeBracket === -1) continue;
    const parsed = readMarkdownDestination(markdown, closeBracket + 2);
    if (!parsed) continue;
    ranges.push({ start, end: parsed.end });
    open.lastIndex = parsed.end;
  }
  return ranges;
}

/** Finds reference definition lines that the verifier intentionally ignores. */
function referenceDefinitionRanges(markdown: string, codeExcluded: ReadonlyArray<Range>): Range[] {
  const ranges: Range[] = [];
  const pattern = /^( {0,3})\[([^\]\r\n]+)\]:[ \t]*\S+(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const start = match.index;
    if (isInRanges(start, codeExcluded)) continue;
    ranges.push({ start, end: start + match[0].length });
  }
  return ranges;
}

/** Reads a markdown inline-link destination, including balanced parentheses. */
function readMarkdownDestination(
  markdown: string,
  destinationStart: number
): { url: string; urlStart: number; end: number } | undefined {
  let cursor = destinationStart;
  while (markdown[cursor] === " " || markdown[cursor] === "\t") cursor += 1;
  const urlStart = cursor;
  let depth = 0;
  while (cursor < markdown.length) {
    const character = markdown[cursor];
    if (character === "\n" || character === "\r") return undefined;
    if (character === "\\") {
      const escaped = markdown[cursor + 1];
      if (escaped === "\n" || escaped === "\r") return undefined;
      cursor += 2;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      if (depth === 0) break;
      depth -= 1;
    }
    cursor += 1;
  }
  if (cursor >= markdown.length || cursor === urlStart) return undefined;
  const rawDestination = markdown.slice(urlStart, cursor).trimEnd();
  const titleSplit = rawDestination.search(/[ \t](?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/);
  const url = titleSplit >= 0 ? rawDestination.slice(0, titleSplit) : rawDestination;
  if (url.length === 0) return undefined;
  return { url, urlStart, end: cursor + 1 };
}

/** Collects CommonMark autolink URLs while skipping excluded ranges. */
function collectAutolinks(markdown: string, excluded: ReadonlyArray<Range>, found: UrlMatch[]): void {
  AUTOLINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AUTOLINK.exec(markdown)) !== null) {
    if (isInRanges(match.index, excluded)) continue;
    found.push({ url: match[1]!, start: match.index, end: match.index + match[0].length });
  }
}

/** Collects bare HTTP(S) URLs while trimming punctuation outside the URL. */
function collectBareUrls(markdown: string, excluded: ReadonlyArray<Range>, found: UrlMatch[]): void {
  BARE_URL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_URL.exec(markdown)) !== null) {
    if (isInRanges(match.index, excluded)) continue;
    const trimmed = match[0].replace(TRAILING_PUNCTUATION, "");
    if (trimmed.length === 0) continue;
    found.push({ url: trimmed, start: match.index, end: match.index + trimmed.length });
  }
}

/** Decodes the small HTML entity set commonly seen in markdown link URLs. */
function decodeCommonHtmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#39);/gi, entity => {
    const lower = entity.toLowerCase();
    if (lower === "&amp;") return "&";
    if (lower === "&lt;") return "<";
    if (lower === "&gt;") return ">";
    if (lower === "&quot;") return '"';
    if (lower === "&apos;" || lower === "&#39;") return "'";
    return entity;
  });
}

/** Sorts query parameters for stable cross-stage URL comparisons. */
function sortedQueryString(params: URLSearchParams): string {
  const entries = [...params.entries()];
  if (entries.length === 0) return "";
  entries.sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
  );
  const sorted = new URLSearchParams();
  for (const [key, value] of entries) sorted.append(key, value);
  return `?${sorted.toString()}`;
}
