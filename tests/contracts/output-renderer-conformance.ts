/** Provides shared conformance assertions for output renderers. */
import { expect } from "vitest";

import type { OutputRenderer, OutputRendererInput } from "../../src/contracts/extensions/output-renderer.js";
import { textBody, binaryBody } from "../helpers/body.js";

export function makeRenderInput(overrides: Partial<OutputRendererInput> = {}): OutputRendererInput {
  return {
    pipelineName: "test",
    body: textBody({ content: "hello" }),
    signals: new Map(),
    artifacts: new Map(),
    report: {
      url: "https://example.com/",
      startedAt: 1,
      durationMs: 2,
      initialLength: 5,
      finalLength: 5,
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

  const withBinary = await renderer.render(
    makeRenderInput({
      body: binaryBody({ bytes: new Uint8Array([37, 80, 68, 70]), mediaType: "application/pdf" }),
      report: {
        ...makeRenderInput().report,
        result: "failed",
        error: "unconverted_binary: application/pdf"
      }
    })
  );
  expect(typeof withBinary.markdown).toBe("string");
}
