import type { ExtractedMarkdownCodeBlock, MarkdownCodeBlockKind } from "./types.js";

import { normalizeLanguageAlias } from "./normalize.js";

// Markdown fenced code-block extraction over untrusted external content.
// Only closed backtick and tilde fences are emitted; ambiguous indented code is out of scope.

interface Line {
  readonly start: number;
  readonly end: number;
  readonly content: string;
}

interface OpenFence {
  readonly kind: MarkdownCodeBlockKind;
  readonly marker: "`" | "~";
  readonly size: number;
  readonly rawInfo?: string;
  readonly language?: string;
}

/**
 * Extract closed fenced code blocks with exact source spans. Supported blocks start with up to
 * three leading spaces and at least three backticks or tildes. Indented code blocks and unclosed
 * fences are not extracted because they are unsafe to treat as confident code repair candidates.
 */
export function extractMarkdownCodeBlocks(markdown: string): ExtractedMarkdownCodeBlock[] {
  const drafts: Omit<ExtractedMarkdownCodeBlock, "id" | "occurrenceIndex">[] = [];
  let cursor = 0;

  while (cursor < markdown.length) {
    const openerLine = readLine(markdown, cursor);
    const opener = parseOpenFence(openerLine.content);
    if (!opener) {
      cursor = openerLine.end;
      continue;
    }

    const closerLine = findClosingFence(markdown, openerLine.end, opener);
    if (!closerLine) break;

    drafts.push({
      kind: opener.kind,
      rawBlock: markdown.slice(openerLine.start, closerLine.end),
      rawCode: markdown.slice(openerLine.end, closerLine.start),
      rawInfo: opener.rawInfo,
      language: opener.language,
      start: openerLine.start,
      end: closerLine.end,
      codeStart: openerLine.end,
      codeEnd: closerLine.start
    });
    cursor = closerLine.end;
  }

  return drafts.map((draft, occurrenceIndex) => ({ ...draft, id: `${draft.kind}:${occurrenceIndex}`, occurrenceIndex }));
}

/** Read one physical line, including its line ending in the end offset. */
function readLine(markdown: string, start: number): Line {
  let cursor = start;
  while (cursor < markdown.length && markdown[cursor] !== "\n" && markdown[cursor] !== "\r") cursor += 1;

  const content = markdown.slice(start, cursor);
  if (markdown[cursor] === "\r" && markdown[cursor + 1] === "\n") cursor += 2;
  else if (markdown[cursor] === "\r" || markdown[cursor] === "\n") cursor += 1;

  return { start, end: cursor, content };
}

/** Parse an opening fenced-code line. */
function parseOpenFence(content: string): OpenFence | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(content);
  if (!match) return undefined;

  const fence = match[2];
  const marker = fence[0] as "`" | "~";
  const rawInfo = match[3].trim() || undefined;
  if (marker === "`" && rawInfo?.includes("`")) return undefined;

  return {
    kind: marker === "`" ? "fenced_backtick" : "fenced_tilde",
    marker,
    size: fence.length,
    rawInfo,
    language: languageFromInfo(rawInfo)
  };
}

/** Find the closing fence for an opener. */
function findClosingFence(markdown: string, start: number, opener: OpenFence): Line | undefined {
  let cursor = start;
  while (cursor < markdown.length) {
    const line = readLine(markdown, cursor);
    if (isClosingFence(line.content, opener)) return line;
    cursor = line.end;
  }

  return undefined;
}

/** Return whether a line closes the supplied opener. */
function isClosingFence(content: string, opener: OpenFence): boolean {
  const pattern = new RegExp(`^ {0,3}${opener.marker}{${opener.size},}[ \t]*$`);
  return pattern.test(content);
}

/** Extract the first info-string token as a normalized language. */
function languageFromInfo(rawInfo: string | undefined): string | undefined {
  const firstToken = rawInfo?.split(/[ \t]+/, 1)[0];
  return firstToken ? normalizeLanguageAlias(firstToken) : undefined;
}
