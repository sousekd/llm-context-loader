/**
 * Returns the final markdown body without decoration.
 *
 * When a pipeline failed before producing a body, this renderer returns the
 * pipeline error message so clients do not receive a silent empty document.
 */

import type {
  OutputRenderer,
  OutputRendererInput,
  OutputRendererResult
} from "../../../contracts/extensions/output-renderer.js";

/** Returns the final body content unchanged. */
export class PassthroughRenderer implements OutputRenderer {
  /** Returns the body content as markdown. */
  render(input: OutputRendererInput): OutputRendererResult {
    if (!input.body && input.report.result === "failed") return { markdown: input.report.error ?? "Pipeline failed." };
    return { markdown: input.body?.content ?? "" };
  }
}
