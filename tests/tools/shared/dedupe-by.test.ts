import { describe, expect, it } from "vitest";

import { dedupeBy } from "../../../src/tools/shared/dedupe-by.js";

describe("dedupeBy", () => {
  it("returns input order with later duplicates removed", () => {
    const items = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
      { id: "c", n: 4 }
    ];

    expect(dedupeBy(items, (item) => item.id)).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "c", n: 4 }
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeBy([], () => "x")).toEqual([]);
  });

  it("supports non-string keys", () => {
    const items = [{ n: 1 }, { n: 1 }, { n: 2 }];

    expect(dedupeBy(items, (item) => item.n)).toEqual([{ n: 1 }, { n: 2 }]);
  });
});

