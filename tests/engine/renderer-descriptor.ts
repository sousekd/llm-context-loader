/**
 * Shared renderer descriptor for create-engine tests.
 */
import { isTextBody } from "../../src/contracts/pipeline/context.js";
import type { OutputRendererDescriptor, OutputRendererInput } from "../../src/contracts/extensions/output-renderer.js";

export const markdownRendererDescriptor = {
  type: "markdown",
  parseConfig: () => ({}),
  create: () => ({
    render: (input: OutputRendererInput) => {
      const content = input.body && isTextBody(input.body) ? input.body.content : "";
      return { markdown: content };
    }
  })
} satisfies OutputRendererDescriptor<unknown>;
