/** Verifies the truncate pipeline step behavior. */
import { describe, expect, it } from "vitest";

import { TruncateStep } from "../../../../src/builtins/pipeline-steps/truncate/truncate-step.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

describe("TruncateStep", () => {
  it("skips on binary body", async () => {
    const step = new TruncateStep({ targetChars: 100 }, { logger: createTestLogger() });

    const result = await step.run(makeStepContext({ body: { bytes: new Uint8Array([1, 2, 3]) } }));

    expect(result).toMatchObject({ status: "skipped", reason: "unsupported_media_type" });
  });

  it("skips without a body or when under target", async () => {
    const step = new TruncateStep({ targetChars: 10 }, { logger: createTestLogger() });

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "skipped", reason: "no_body" });
    await expect(step.run(makeStepContext({ body: { content: "short" } }))).resolves.toMatchObject({
      status: "skipped",
      reason: "under_target"
    });
  });

  it("truncates long content and carries title explicitly", async () => {
    const step = new TruncateStep({ targetChars: 20 }, { logger: createTestLogger() });

    const result = await step.run(
      makeStepContext({ body: { content: "one two three four five six", title: "Title" } })
    );

    expect(result.status).toBe("ok");
    expect(result.effects?.body).toEqual({
      kind: "text",
      content: "one t... [TRUNCATED]",
      mediaType: "text/markdown",
      title: "Title"
    });
    expect(result.effects?.body?.kind).toBe("text");
    if (result.effects?.body?.kind === "text") expect(result.effects.body.content.length).toBe(20);
    expect(result.effects?.body?.title).toBe("Title");
  });

  it("keeps the output within very small budgets", async () => {
    const step = new TruncateStep({ targetChars: 8 }, { logger: createTestLogger() });

    const result = await step.run(makeStepContext({ body: { content: "long content" } }));

    expect(result.effects?.body).toEqual({
      kind: "text",
      content: "... [TRU",
      mediaType: "text/markdown",
      title: undefined
    });
    expect(result.effects?.body?.kind).toBe("text");
    if (result.effects?.body?.kind === "text") expect(result.effects.body.content.length).toBe(8);
  });
});
