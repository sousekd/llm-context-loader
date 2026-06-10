/** Verifies the verify-urls pipeline step behavior. */
import { describe, expect, it } from "vitest";

import { VerifyUrlsStep } from "../../../../src/builtins/pipeline-steps/verify-urls/verify-urls-step.js";
import { createTestLogger } from "../../../helpers/logger.js";
import { makeStepContext } from "../utils.js";

const ARTIFACT = "trusted-urls";
const CHECKED_KEY = `${ARTIFACT}:checked-content`;

function inventory(urls: ReadonlyArray<string>): Map<string, unknown> {
  return new Map<string, unknown>([[ARTIFACT, new Set(urls)]]);
}

describe("VerifyUrlsStep", () => {
  it("skips when no body is present", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });

    await expect(step.run(makeStepContext())).resolves.toMatchObject({ status: "skipped", reason: "no_body" });
  });

  it("skips when the inventory artifact is absent", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });

    const result = await step.run(makeStepContext({ body: { content: "[x](https://example.com/x)" } }));

    expect(result).toMatchObject({ status: "skipped", reason: "no_inventory" });
  });

  it("returns ok when all body URLs are in the inventory", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });

    const result = await step.run(
      makeStepContext({
        body: { content: "Visit [docs](https://example.com/docs) and https://example.com/other" },
        artifacts: inventory(["https://example.com/docs", "https://example.com/other"])
      })
    );

    expect(result.status).toBe("ok");
    expect(result.diagnostics?.attributes).toMatchObject({ artifact: ARTIFACT, url_count: 2 });
    expect(result.effects?.artifacts).toEqual({
      [CHECKED_KEY]: "Visit [docs](https://example.com/docs) and https://example.com/other"
    });
  });

  it("reports hallucinations without rolling back in report mode", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });

    const result = await step.run(
      makeStepContext({
        body: { content: "[good](https://example.com/docs) [bad](https://example.com/hallucinated)" },
        artifacts: inventory(["https://example.com/docs"])
      })
    );

    expect(result.status).toBe("degraded");
    expect(result.reason).toBe("hallucinated_urls");
    expect(result.effects?.body).toBeUndefined();
    expect(result.effects?.artifacts).toEqual({
      [CHECKED_KEY]: "[good](https://example.com/docs) [bad](https://example.com/hallucinated)"
    });
    expect(result.diagnostics?.attributes).toMatchObject({ hallucinated_count: 1, reported_count: 1 });
    expect(result.diagnostics?.children).toEqual([
      { name: "hallucinated_url", attributes: { url: "https://example.com/hallucinated", occurrences: 1 } }
    ]);
  });

  it("rolls the body back to the prior version in rollback mode", async () => {
    const step = new VerifyUrlsStep(
      { artifact: ARTIFACT, onHallucination: "rollback" },
      { logger: createTestLogger() }
    );

    const result = await step.run(
      makeStepContext({
        bodyVersions: [
          { stepName: "firecrawl", content: "Original body with [good](https://example.com/good)", title: "Title" },
          { stepName: "clean", content: "Cleaned body with [bad](https://example.com/bad)", title: "Title" }
        ],
        artifacts: inventory(["https://example.com/good"])
      })
    );

    expect(result.status).toBe("degraded");
    expect(result.reason).toBe("hallucinated_urls");
    expect(result.effects?.body).toEqual({
      content: "Original body with [good](https://example.com/good)",
      mediaType: "text/markdown",
      title: "Title"
    });
    expect(result.effects?.artifacts).toBeUndefined();
    expect(result.diagnostics?.children).toEqual([
      { name: "hallucinated_url", attributes: { url: "https://example.com/bad", occurrences: 1 } }
    ]);
  });

  it("skips rollback when no prior body version exists", async () => {
    const step = new VerifyUrlsStep(
      { artifact: ARTIFACT, onHallucination: "rollback" },
      { logger: createTestLogger() }
    );

    const result = await step.run(
      makeStepContext({
        body: { content: "[bad](https://example.com/bad)" },
        artifacts: inventory(["https://example.com/good"])
      })
    );

    expect(result).toMatchObject({ status: "skipped", reason: "no_prior_version" });
  });

  it("skips when the body is unchanged since it was last checked", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });
    const content = "[bad](https://example.com/hallucinated)";
    const artifacts = inventory(["https://example.com/good"]);
    artifacts.set(CHECKED_KEY, content);

    const result = await step.run(makeStepContext({ body: { content }, artifacts }));

    expect(result).toMatchObject({ status: "skipped", reason: "content_unchanged" });
    expect(result.effects).toBeUndefined();
  });

  it("verifies when the body differs from the last checked content", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });
    const artifacts = inventory(["https://example.com/good"]);
    artifacts.set(CHECKED_KEY, "Original [good](https://example.com/good)");

    const result = await step.run(
      makeStepContext({ body: { content: "[bad](https://example.com/hallucinated)" }, artifacts })
    );

    expect(result.status).toBe("degraded");
    expect(result.reason).toBe("hallucinated_urls");
  });

  it("ignores artifacts that are not Set instances", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });

    const result = await step.run(
      makeStepContext({
        body: { content: "[x](https://example.com/x)" },
        artifacts: new Map<string, unknown>([[ARTIFACT, ["https://example.com/x"]]])
      })
    );

    expect(result).toMatchObject({ status: "skipped", reason: "no_inventory" });
  });

  it("caps the number of hallucinated URL children but reports the full count", async () => {
    const step = new VerifyUrlsStep(
      { artifact: ARTIFACT, onHallucination: "report", maxReportedUrls: 50 },
      { logger: createTestLogger() }
    );
    const badUrls = Array.from({ length: 60 }, (_, index) => `https://example.com/bad-${index}`);
    const links = badUrls.map((url, index) => `[bad${index}](${url})`).join("\n");

    const result = await step.run(
      makeStepContext({
        body: { content: links },
        artifacts: inventory([])
      })
    );

    expect(result.status).toBe("degraded");
    expect(result.diagnostics?.attributes).toMatchObject({ hallucinated_count: 60, reported_count: 50 });
    expect(result.diagnostics?.children?.length).toBe(50);
  });

  it("reports no children when maxReportedUrls is 0 but keeps the full count in attributes", async () => {
    const step = new VerifyUrlsStep(
      { artifact: ARTIFACT, onHallucination: "rollback", maxReportedUrls: 0 },
      { logger: createTestLogger() }
    );

    const result = await step.run(
      makeStepContext({
        bodyVersions: [
          { stepName: "firecrawl", content: "Original with [good](https://example.com/good)", title: "T" },
          { stepName: "clean", content: "[a](https://example.com/a) [b](https://example.com/b)", title: "T" }
        ],
        artifacts: inventory(["https://example.com/good"])
      })
    );

    expect(result.status).toBe("degraded");
    expect(result.diagnostics?.attributes).toMatchObject({ hallucinated_count: 2, reported_count: 0 });
    expect(result.diagnostics?.children).toEqual([]);
    expect(result.effects?.body).toBeDefined();
  });

  it("reports all children when maxReportedUrls is undefined", async () => {
    const step = new VerifyUrlsStep({ artifact: ARTIFACT, onHallucination: "report" }, { logger: createTestLogger() });
    const badUrls = Array.from({ length: 5 }, (_, index) => `https://example.com/x${index}`);
    const links = badUrls.map((url, index) => `[x${index}](${url})`).join("\n");

    const result = await step.run(makeStepContext({ body: { content: links }, artifacts: inventory([]) }));

    expect(result.diagnostics?.attributes).toMatchObject({ hallucinated_count: 5, reported_count: 5 });
    expect(result.diagnostics?.children?.length).toBe(5);
  });

  it("deduplicates URLs, counts occurrences, and sorts worst-offender first", async () => {
    const step = new VerifyUrlsStep(
      { artifact: ARTIFACT, onHallucination: "report", maxReportedUrls: 10 },
      { logger: createTestLogger() }
    );
    const content = [
      "[a](https://example.com/aaa)",
      "[a-dup](https://example.com/aaa)",
      "[a-tri](https://example.com/aaa)",
      "[b](https://example.com/bbb)",
      "[b-dup](https://example.com/bbb)",
      "[c](https://example.com/ccc)"
    ].join("\n");

    const result = await step.run(makeStepContext({ body: { content }, artifacts: inventory([]) }));

    expect(result.diagnostics?.attributes).toMatchObject({ hallucinated_count: 3, reported_count: 3 });
    expect(result.diagnostics?.children).toEqual([
      { name: "hallucinated_url", attributes: { url: "https://example.com/aaa", occurrences: 3 } },
      { name: "hallucinated_url", attributes: { url: "https://example.com/bbb", occurrences: 2 } },
      { name: "hallucinated_url", attributes: { url: "https://example.com/ccc", occurrences: 1 } }
    ]);
  });
});
