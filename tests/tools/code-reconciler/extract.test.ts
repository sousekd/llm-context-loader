import { describe, expect, it } from "vitest";

import { extractMarkdownCodeBlocks } from "../../../src/tools/code-reconciler/extract.js";

describe("extractMarkdownCodeBlocks", () => {
  it("extracts backtick fences with exact spans", () => {
    const markdown = "Before\n```ts title\nconst x = 1;\n```\nAfter";
    const [block] = extractMarkdownCodeBlocks(markdown);

    expect(block).toMatchObject({ kind: "fenced_backtick", rawInfo: "ts title", language: "typescript", rawCode: "const x = 1;\n" });
    expect(markdown.slice(block.start, block.end)).toBe(block.rawBlock);
    expect(markdown.slice(block.codeStart, block.codeEnd)).toBe(block.rawCode);
  });

  it("extracts tilde fences", () => {
    const [block] = extractMarkdownCodeBlocks("~~~sh\necho hi\n~~~");

    expect(block).toMatchObject({ kind: "fenced_tilde", language: "shell", rawCode: "echo hi\n" });
  });

  it("requires closing fences to match marker and minimum opener length", () => {
    const markdown = "````md\n```js\nconst x = 1;\n```\n````";
    const [block] = extractMarkdownCodeBlocks(markdown);

    expect(block.rawCode).toBe("```js\nconst x = 1;\n```\n");
  });

  it("skips unclosed fences entirely", () => {
    const markdown = "```ts\nconst before = true;\n```\n```js\nconst truncated = true;\n\n~~~ts\nconst after = true;\n~~~";
    const blocks = extractMarkdownCodeBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].rawCode).toBe("const before = true;\n");
  });

  it("does not extract indented code blocks", () => {
    expect(extractMarkdownCodeBlocks("    const x = 1;\n")).toEqual([]);
  });

  it("does not extract inline code spans", () => {
    expect(extractMarkdownCodeBlocks("Use `const x = 1` here.")).toEqual([]);
  });

  it("rejects backtick info strings containing backticks", () => {
    expect(extractMarkdownCodeBlocks("```bad`info\nconst x = 1;\n```")).toEqual([]);
  });

  it("handles CRLF source spans", () => {
    const markdown = "```ts\r\nconst x = 1;\r\n```\r\n";
    const [block] = extractMarkdownCodeBlocks(markdown);

    expect(block.rawBlock).toBe(markdown);
    expect(block.rawCode).toBe("const x = 1;\r\n");
  });

  it("does not recognize fences indented by four or more spaces", () => {
    expect(extractMarkdownCodeBlocks("    ```ts\n    const x = 1;\n    ```\n")).toEqual([]);
  });

  it("emits sequential ids and occurrenceIndex values for back-to-back blocks", () => {
    const blocks = extractMarkdownCodeBlocks("```ts\na\n```\n```ts\nb\n```\n");

    expect(blocks).toHaveLength(2);
    expect(blocks[0].occurrenceIndex).toBe(0);
    expect(blocks[1].occurrenceIndex).toBe(1);
    expect(blocks[0].id).toBe("fenced_backtick:0");
    expect(blocks[1].id).toBe("fenced_backtick:1");
  });

  it("treats whitespace-only info strings as no language", () => {
    const [block] = extractMarkdownCodeBlocks("```   \nbody\n```");

    expect(block.rawInfo).toBeUndefined();
    expect(block.language).toBeUndefined();
  });

  it("accepts closing fences longer than the opener", () => {
    const [block] = extractMarkdownCodeBlocks("~~~sh\necho hi\n~~~~~\n");

    expect(block.rawCode).toBe("echo hi\n");
  });
});
