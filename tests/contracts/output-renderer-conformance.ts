/** Provides shared conformance assertions for output renderers. */
import { expect } from "vitest";

import type { OutputRenderer, OutputRendererInput } from "../../src/contracts/extensions/output-renderer.js";

export function makeRenderInput(overrides: Partial<OutputRendererInput> = {}): OutputRendererInput {
  return {
    pipelineName: "test",
    body: { content: "hello" },
    signals: new Map(),
    artifacts: new Map(),
    report: {
      url: "https://example.com/",
      startedAt: 1,
      durationMs: 2,
      initialChars: 5,
      finalChars: 5,
      returned: "source",
      result: "ok",
      steps: []
    },
    ...overrides
  };
}

export async function assertOutputRendererConformance(renderer: OutputRenderer): Promise<void> {
  const withBody = await renderer.render(makeRenderInput());
  expect(typeof withBody.markdown).toBe("string");

  const withoutBody = await renderer.render(makeRenderInput({ body: undefined }));
  expect(typeof withoutBody.markdown).toBe("string");
}
