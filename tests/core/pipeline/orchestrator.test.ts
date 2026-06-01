/** Verifies pipeline orchestration, effects, timeouts, reporting, and limiter grouping. */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PipelineContext } from "../../../src/contracts/pipeline/context.js";
import type { CompiledPipelineStep } from "../../../src/core/pipeline/compiled.js";
import type { PipelineStep, StepResult } from "../../../src/contracts/pipeline/step.js";
import type { ConcurrencyLimiter } from "../../../src/shared/limiters.js";
import { PipelineOrchestrator } from "../../../src/core/pipeline/orchestrator.js";
import { createConcurrencyLimiter } from "../../../src/shared/limiters.js";
import { createTestLogger } from "../../helpers/logger.js";
import { makePipeline } from "../../helpers/pipeline.js";

class FixedClock {
  private time = 1_000;

  now(): number {
    this.time += 1;
    return this.time;
  }
}

class FakeStep implements PipelineStep {
  readonly type = "fake";

  constructor(
    readonly name: string,
    private readonly result: StepResult
  ) {}

  async run(_ctx: PipelineContext): Promise<StepResult> {
    return this.result;
  }
}

class BodyEchoStep implements PipelineStep {
  readonly type = "fake";
  readonly name = "echo";

  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    return { status: "ok", effects: { body: { content: `${body?.content ?? ""}!`, title: body?.title } } };
  }
}

class AbortWatchingStep implements PipelineStep {
  readonly type = "fake";
  readonly name = "slow";

  async run(ctx: PipelineContext): Promise<StepResult> {
    return new Promise((_resolve, reject) => {
      ctx.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")), {
        once: true
      });
    });
  }
}

class ThrowingStep implements PipelineStep {
  readonly type = "fake";
  readonly name = "explode";

  async run(_ctx: PipelineContext): Promise<StepResult> {
    throw new Error("boom");
  }
}

class CountingLimiter implements ConcurrencyLimiter {
  calls = 0;

  async acquire<T>(fn: () => Promise<T>, _signal: AbortSignal): Promise<T> {
    this.calls += 1;
    return fn();
  }
}

class WaitingLimiter implements ConcurrencyLimiter {
  aborted = false;

  async acquire<T>(_fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          this.aborted = true;
          reject(new DOMException("The operation was aborted.", "AbortError"));
        },
        { once: true }
      );
    });
  }
}

describe("PipelineOrchestrator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores effects on skipped results and reports degraded fallback", async () => {
    const pipeline = makePipeline({
      steps: [
        withMeta(new FakeStep("fetch", { status: "ok", effects: { body: { content: "source", title: "Title" } } }), 5),
        withMeta(new FakeStep("clean", { status: "failed", reason: "network" }), 5),
        withMeta(new BodyEchoStep(), 5)
      ]
    });

    const result = await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(result.body).toEqual({ content: "source!", title: "Title" });
    expect(result.report.result).toBe("degraded");
    expect(result.report.initialChars).toBe(6);
    expect(result.report.finalChars).toBe(7);
    expect(result.report.returned).toBe("echo");
    expect(result.report.steps.map(step => step.status)).toEqual(["ok", "failed", "ok"]);
    expect(result.report.steps[1]?.outputChars).toBeUndefined();
  });

  it("applies body effects on failed results and rolls the run up as degraded", async () => {
    const pipeline = makePipeline({
      steps: [
        withMeta(new FakeStep("fetch", { status: "ok", effects: { body: { content: "source", title: "Title" } } }), 5),
        withMeta(
          new FakeStep("verify", {
            status: "failed",
            reason: "hallucinated_urls",
            effects: { body: { content: "source", title: "Title" } }
          }),
          5
        )
      ]
    });

    const result = await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(result.body).toEqual({ content: "source", title: "Title" });
    expect(result.report.result).toBe("degraded");
    expect(result.report.returned).toBe("verify");
    expect(result.report.bodyChangedBy).toBe("verify");
    expect(result.report.bodyProducedBy).toBe("fetch");
    expect(result.report.steps[1]).toMatchObject({
      name: "verify",
      status: "failed",
      reason: "hallucinated_urls",
      outputChars: 6
    });
  });

  it("copies child diagnostics from step results into reports", async () => {
    const pipeline = makePipeline({
      steps: [
        withMeta(
          new FakeStep("fetch", {
            status: "ok",
            diagnostics: { children: [{ name: "attempt", attributes: { count: 1 } }] },
            effects: { body: { content: "source" } }
          }),
          5
        )
      ]
    });

    const result = await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(result.report.steps[0]?.diagnostics?.children).toEqual([{ name: "attempt", attributes: { count: 1 } }]);
  });

  it("coalesces adjacent steps in the same concurrency group", async () => {
    const limiter = new CountingLimiter();
    const pipeline = makePipeline({
      steps: [
        withMeta(new FakeStep("clean", { status: "skipped", reason: "no_body" }), 5, "llm"),
        withMeta(new FakeStep("summarize", { status: "skipped", reason: "no_body" }), 5, "llm"),
        withMeta(new FakeStep("truncate", { status: "skipped", reason: "no_body" }), 5)
      ],
      groups: new Map([["llm", limiter]])
    });

    await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(limiter.calls).toBe(1);
  });

  it("uses the longest adjacent group timeout while waiting for a limiter slot", async () => {
    vi.useFakeTimers();
    const limiter = new WaitingLimiter();
    const pipeline = makePipeline({
      steps: [
        withMeta(new FakeStep("first", { status: "ok" }), 1, "llm"),
        withMeta(new FakeStep("second", { status: "ok" }), 3, "llm")
      ],
      groups: new Map([["llm", limiter]])
    });

    const pending = makeOrchestrator().run(pipeline, { url: "https://example.com/" });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(limiter.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await pending;

    expect(limiter.aborted).toBe(true);
    expect(result.report.steps[0]).toMatchObject({ name: "first", status: "failed", reason: "timeout" });
  });

  it("does not coalesce non-adjacent steps in the same concurrency group", async () => {
    const limiter = new CountingLimiter();
    const pipeline = makePipeline({
      steps: [
        withMeta(new FakeStep("first", { status: "skipped", reason: "no_body" }), 5, "llm"),
        withMeta(new FakeStep("middle", { status: "skipped", reason: "no_body" }), 5),
        withMeta(new FakeStep("second", { status: "skipped", reason: "no_body" }), 5, "llm")
      ],
      groups: new Map([["llm", limiter]])
    });

    await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(limiter.calls).toBe(2);
  });

  it("records failed pipelines when no body was produced", async () => {
    const pipeline = makePipeline({
      steps: [
        withMeta(
          new FakeStep("firecrawl", {
            status: "failed",
            reason: "timeout",
            diagnostics: { attributes: { upstream_code: "etimedout" } }
          }),
          5
        ),
        withMeta(new FakeStep("clean", { status: "skipped", reason: "no_body" }), 5)
      ]
    });

    const result = await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(result.body).toBeUndefined();
    expect(result.report.result).toBe("failed");
    expect(result.report.returned).toBe("none");
    expect(result.report.error).toBe("firecrawl: timeout");
    expect(result.report.steps[0]?.diagnostics?.attributes).toEqual({ upstream_code: "etimedout" });
  });

  it("maps orchestrator-owned step timeouts to failed outcomes", async () => {
    vi.useFakeTimers();
    const pipeline = makePipeline({ steps: [withMeta(new AbortWatchingStep(), 1)] });

    const pending = makeOrchestrator().run(pipeline, { url: "https://example.com/" });
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(result.report.result).toBe("failed");
    expect(result.report.steps[0]).toMatchObject({ name: "slow", status: "failed", reason: "timeout" });
  });

  it("times out limited work while it is waiting for a concurrency slot", async () => {
    vi.useFakeTimers();
    const pipeline = makePipeline({
      steps: [withMeta(new AbortWatchingStep(), 1, "llm")],
      groups: new Map([["llm", createConcurrencyLimiter(1)]])
    });
    const orchestrator = makeOrchestrator();

    const first = orchestrator.run(pipeline, { url: "https://first.example/" });
    const second = orchestrator.run(pipeline, { url: "https://second.example/" });
    await vi.advanceTimersByTimeAsync(1_000);
    const secondResult = await second;
    const firstResult = await first;

    expect(secondResult.report.steps[0]).toMatchObject({ name: "slow", status: "failed", reason: "timeout" });
    expect(firstResult.report.steps[0]).toMatchObject({ name: "slow", status: "failed", reason: "timeout" });
  });

  it("maps unexpected step throws to failed outcomes", async () => {
    const pipeline = makePipeline({ steps: [withMeta(new ThrowingStep(), 5)] });

    const result = await makeOrchestrator().run(pipeline, { url: "https://example.com/" });

    expect(result.report.result).toBe("failed");
    expect(result.report.steps[0]).toMatchObject({ name: "explode", status: "failed", reason: "thrown" });
  });
});

function makeOrchestrator(): PipelineOrchestrator {
  return new PipelineOrchestrator({ logger: createTestLogger(), clock: new FixedClock() });
}

function withMeta<T extends PipelineStep & { readonly name: string; readonly type: string }>(
  step: T,
  timeoutSeconds: number,
  concurrencyGroup?: string
): CompiledPipelineStep {
  return { name: step.name, type: step.type, timeoutSeconds, concurrencyGroup, step };
}
