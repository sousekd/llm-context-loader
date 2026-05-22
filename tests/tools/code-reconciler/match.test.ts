import { describe, expect, it } from "vitest";

import { extractMarkdownCodeBlocks } from "../../../src/tools/code-reconciler/extract.js";
import { buildTrustedCodeBlockInventory } from "../../../src/tools/code-reconciler/inventory.js";
import { matchByNormalizedCode } from "../../../src/tools/code-reconciler/match-normalized-code.js";
import { matchByRawBlock } from "../../../src/tools/code-reconciler/match-raw-block.js";
import { matchByRawCode } from "../../../src/tools/code-reconciler/match-raw-code.js";

function inventory(markdown: string) {
  return buildTrustedCodeBlockInventory(extractMarkdownCodeBlocks(markdown), { trimFinalNewline: true, trimTrailingLineWs: true });
}

describe("code-block matchers", () => {
  it("matches exact raw blocks", () => {
    const [candidate] = extractMarkdownCodeBlocks("```ts\nconst x = 1;\n```");

    expect(matchByRawBlock(candidate, inventory("```ts\nconst x = 1;\n```")).kind).toBe("match");
  });

  it("matches exact code across fence style changes", () => {
    const [candidate] = extractMarkdownCodeBlocks("~~~ts\nconst x = 1;\n~~~");
    const result = matchByRawCode(candidate, inventory("```ts\nconst x = 1;\n```"));

    expect(result).toMatchObject({ kind: "match", record: { extracted: { rawBlock: "```ts\nconst x = 1;\n```" } } });
  });

  it("returns ambiguous for identical code bodies unless callers filter", () => {
    const [candidate] = extractMarkdownCodeBlocks("```ts\nconst x = 1;\n```");
    const trusted = inventory("```ts\nconst x = 1;\n```\n```js\nconst x = 1;\n```");

    expect(matchByRawCode(candidate, trusted).kind).toBe("ambiguous");
    expect(matchByRawCode(candidate, trusted, { filter: (_candidate, record) => record.language === "typescript" }).kind).toBe("match");
  });

  it("matches normalized code when final newline or trailing spaces differ", () => {
    const [candidate] = extractMarkdownCodeBlocks("```ts\nconst x = 1;\n```");
    const result = matchByNormalizedCode(candidate, inventory("```ts\nconst x = 1;  \n```"), { trimFinalNewline: true, trimTrailingLineWs: true });

    expect(result.kind).toBe("match");
  });

  it("returns none for a subtle code change", () => {
    const [candidate] = extractMarkdownCodeBlocks("```ts\nif (x > 1) return x;\n```");

    expect(matchByNormalizedCode(candidate, inventory("```ts\nif (x < 1) return x;\n```"), { trimFinalNewline: true }).kind).toBe("none");
  });
});
