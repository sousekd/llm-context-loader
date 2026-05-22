import type { ExtractedMarkdownUrl, ExtractUrlsOptions } from "./types.js";

// Markdown URL extraction over untrusted external content.
// Extracted spans point into the original string and exclude fenced or inline code.

interface Range {
  readonly start: number;
  readonly end: number;
}

interface DraftUrl {
  readonly kind: ExtractedMarkdownUrl["kind"];
  readonly rawUrl: string;
  readonly rawMatch: string;
  readonly start: number;
  readonly end: number;
  readonly urlStart: number;
  readonly urlEnd: number;
  readonly text?: string;
}

const BARE_URL = /\bhttps?:\/\/[^\s<`]+/gi;
const AUTOLINK = /<((?:https?:\/\/)[^\s<>]+)>/gi;
const REFERENCE_DEFINITION_LINE = /^( {0,3})\[([^\]\r\n]+)\]:[ \t]*(\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/i;

/**
 * Extract URL-like markdown constructs with source spans. Supported kinds: inline links
 * `[text](url)`, image links `![alt](url)`, reference definitions `[label]: url`, autolinks
 * `<https://...>`, and (optionally) bare `https://` URLs. Reference usages
 * `[text][label]`, collapsed `[label][]`, and shortcut `[label]` references are not resolved;
 * only the matching reference *definitions* are returned. Spans inside fenced or inline code
 * are excluded. When constructs overlap, extraction order gives markdown link syntax priority
 * over autolinks and bare URLs.
 */
export function extractMarkdownUrls(markdown: string, options: ExtractUrlsOptions = {}): ExtractedMarkdownUrl[] {
  const excluded = mergeRanges([...fencedCodeRanges(markdown), ...inlineCodeRanges(markdown)]);
  const drafts = [
    ...extractInlineLinks(markdown, excluded, options),
    ...extractReferenceDefinitions(markdown, excluded, options),
    ...extractAutolinks(markdown, excluded),
    ...extractBareUrls(markdown, excluded, options)
  ];

  return drafts
    .filter((draft, index, all) => all.findIndex((other) => overlaps(draft, other)) === index)
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((draft, occurrenceIndex) => ({ ...draft, id: `${draft.kind}:${occurrenceIndex}`, occurrenceIndex }));
}

/** Find fenced code ranges. */
function fencedCodeRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const fence = /^( {0,3})(`{3,}|~{3,})[^\n\r]*(?:\r?\n|$)/gm;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(markdown)) !== null) {
    const marker = match[2][0];
    const size = match[2].length;
    const close = new RegExp(`^ {0,3}${escapeRegExp(marker.repeat(size))}${marker}*[ \\t]*(?:\\r?\\n|$)`, "gm");
    close.lastIndex = fence.lastIndex;
    const closeMatch = close.exec(markdown);
    ranges.push({ start: match.index, end: closeMatch ? close.lastIndex : markdown.length });
    fence.lastIndex = closeMatch ? close.lastIndex : markdown.length;
  }

  return ranges;
}

/** Find inline code spans outside fenced code. */
function inlineCodeRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const inline = /(`+)([^`\r\n]|`(?!`))*?\1/g;
  let match: RegExpExecArray | null;

  while ((match = inline.exec(markdown)) !== null) {
    ranges.push({ start: match.index, end: inline.lastIndex });
  }

  return ranges;
}

/** Extract inline link and image destinations. */
function extractInlineLinks(markdown: string, excluded: readonly Range[], options: ExtractUrlsOptions): DraftUrl[] {
  const drafts: DraftUrl[] = [];
  let index = 0;

  while (index < markdown.length) {
    const openBracket = markdown.indexOf("[", index);
    if (openBracket === -1) break;

    const image = openBracket > 0 && markdown[openBracket - 1] === "!";
    const start = image ? openBracket - 1 : openBracket;
    if (image && options.includeImages === false) {
      index = openBracket + 1;
      continue;
    }

    const closeBracket = markdown.indexOf("](", openBracket);
    if (closeBracket === -1) break;

    const text = markdown.slice(openBracket + 1, closeBracket);
    if (text.includes("\n") || text.includes("\r")) {
      index = openBracket + 1;
      continue;
    }

    const destinationStart = closeBracket + 2;
    const parsed = readMarkdownDestination(markdown, destinationStart);
    if (parsed && !isInRanges(start, excluded) && !isInRanges(parsed.urlStart, excluded)) {
      drafts.push({
        kind: image ? "image" : "inline",
        rawUrl: parsed.rawUrl,
        rawMatch: markdown.slice(start, parsed.end),
        start,
        end: parsed.end,
        urlStart: parsed.urlStart,
        urlEnd: parsed.urlEnd,
        text
      });
      index = parsed.end;
    } else {
      index = closeBracket + 2;
    }
  }

  return drafts;
}

/** Read a markdown link destination after the opening parenthesis. */
function readMarkdownDestination(markdown: string, destinationStart: number): { rawUrl: string; end: number; urlStart: number; urlEnd: number } | undefined {
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
  const titleStart = rawDestination.search(/[ \t](?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/);
  const rawUrl = titleStart >= 0 ? rawDestination.slice(0, titleStart) : rawDestination;
  const urlEnd = urlStart + rawUrl.length;

  return { rawUrl, end: cursor + 1, urlStart, urlEnd };
}

/** Extract reference definition URLs. */
function extractReferenceDefinitions(markdown: string, excluded: readonly Range[], options: ExtractUrlsOptions): DraftUrl[] {
  if (options.includeReferenceDefinitions === false) return [];

  const drafts: DraftUrl[] = [];
  let offset = 0;

  for (const line of markdown.match(/.*(?:\r?\n|$)/g) ?? []) {
    if (line.length === 0) continue;

    const lineText = line.replace(/\r?\n$/, "");
    const match = REFERENCE_DEFINITION_LINE.exec(lineText);
    if (match) {
      const rawUrl = trimBareUrl(match[3]);
      const urlStart = offset + lineText.indexOf(match[3]);
      const urlEnd = urlStart + rawUrl.length;
      if (!isInRanges(offset, excluded)) {
        drafts.push({
          kind: "reference_definition",
          rawUrl,
          rawMatch: lineText,
          start: offset,
          end: offset + lineText.length,
          urlStart,
          urlEnd,
          text: match[2]
        });
      }
    }
    offset += line.length;
  }

  return drafts;
}

/** Extract markdown autolinks. */
function extractAutolinks(markdown: string, excluded: readonly Range[]): DraftUrl[] {
  const drafts: DraftUrl[] = [];
  let match: RegExpExecArray | null;
  AUTOLINK.lastIndex = 0;

  while ((match = AUTOLINK.exec(markdown)) !== null) {
    if (!isInRanges(match.index, excluded)) {
      drafts.push({
        kind: "autolink",
        rawUrl: match[1],
        rawMatch: match[0],
        start: match.index,
        end: AUTOLINK.lastIndex,
        urlStart: match.index + 1,
        urlEnd: AUTOLINK.lastIndex - 1
      });
    }
  }

  return drafts;
}

/** Extract bare HTTP(S) URLs. */
function extractBareUrls(markdown: string, excluded: readonly Range[], options: ExtractUrlsOptions): DraftUrl[] {
  if (options.includeBareUrls === false) return [];

  const drafts: DraftUrl[] = [];
  let match: RegExpExecArray | null;
  BARE_URL.lastIndex = 0;

  while ((match = BARE_URL.exec(markdown)) !== null) {
    const rawUrl = trimBareUrl(match[0]);
    const end = match.index + rawUrl.length;
    if (!isInRanges(match.index, excluded) && !isMarkdownDestinationUrl(markdown, match.index)) {
      drafts.push({
        kind: "bare",
        rawUrl,
        rawMatch: rawUrl,
        start: match.index,
        end,
        urlStart: match.index,
        urlEnd: end
      });
    }
  }

  return drafts;
}

/** Trim bare URL punctuation from prose. */
function trimBareUrl(value: string): string {
  let output = value;
  while (/[.,;:!?\]]$/.test(output)) output = output.slice(0, -1);
  while (output.endsWith(")") && count(output, "(") < count(output, ")")) output = output.slice(0, -1);
  return output;
}

/** Merge overlapping ranges. */
function mergeRanges(ranges: readonly Range[]): Range[] {
  const ordered = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Range[] = [];

  for (const range of ordered) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    } else {
      merged.push(range);
    }
  }

  return merged;
}

/** Test whether an index sits inside any range. */
function isInRanges(index: number, ranges: readonly Range[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

/** Test whether two extracted spans overlap. */
function overlaps(left: DraftUrl, right: DraftUrl): boolean {
  return left.start < right.end && right.start < left.end;
}

/** Count occurrences of one character. */
function count(value: string, character: string): number {
  let total = 0;
  for (const current of value) {
    if (current === character) total += 1;
  }
  return total;
}

/** Escape literal text for dynamic regular expressions. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Test whether a bare URL is inside a markdown link destination. */
function isMarkdownDestinationUrl(markdown: string, urlStart: number): boolean {
  let cursor = urlStart - 1;
  while (cursor >= 0 && (markdown[cursor] === " " || markdown[cursor] === "\t")) cursor -= 1;
  return cursor >= 1 && markdown[cursor] === "(" && markdown[cursor - 1] === "]";
}
