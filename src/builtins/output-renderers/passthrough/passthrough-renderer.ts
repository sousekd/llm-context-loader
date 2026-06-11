/**
 * Returns the final body content without decoration.
 *
 * When a pipeline failed before producing a body, or when the final body is
 * binary and no converter handled it, this renderer returns the pipeline error
 * message so clients do not receive a silent empty document.
 */

import type {
  OutputRenderer,
  OutputRendererInput,
  OutputRendererResult
} from "../../../contracts/extensions/output-renderer.js";
import { isTextBody } from "../../../contracts/pipeline/context.js";

/** Returns the final body content unchanged. */
export class PassthroughRenderer implements OutputRenderer {
  /** Returns the body content as markdown. */
  render(input: OutputRendererInput): OutputRendererResult {
    if (input.body && isTextBody(input.body)) return { markdown: input.body.content };
    if (input.report.result === "failed") return { markdown: input.report.error ?? "Pipeline failed." };
    return { markdown: "" };
  }
}
