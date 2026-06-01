/**
 * Appends an XML diagnostic footer to the final markdown body.
 *
 * When a pipeline produced no body, the renderer returns the footer alone so
 * Open WebUI and markdown clients still receive visible diagnostics instead of
 * an empty document.
 */

import { serializeFooter } from "./footer-serializer.js";

import type {
  OutputRenderer,
  OutputRendererInput,
  OutputRendererResult
} from "../../../contracts/extensions/output-renderer.js";
import type { Logger } from "../../../shared/logger.js";
import type { DebugXmlRendererConfig } from "./debug-xml-renderer-config.js";

/** Appends a deterministic XML diagnostic footer to the rendered body. */
export class DebugXmlRenderer implements OutputRenderer {
  private readonly logger: Logger;

  /** Creates a debug-xml renderer bound to a YAML instance name and config. */
  constructor(
    private readonly config: DebugXmlRendererConfig,
    deps: { readonly logger: Logger }
  ) {
    this.logger = deps.logger;
  }

  /** Returns the body followed by an XML diagnostic footer. */
  render(input: OutputRendererInput): OutputRendererResult {
    const content = input.body?.content ?? "";
    const footer = serializeFooter(input.report, {
      rootElement: this.config.rootElement,
      includeSkipped: this.config.includeSkipped
    });
    this.logger.debug({ footer }, "Diagnostic footer rendered.");
    return { markdown: content ? `${content}\n\n${footer}` : footer };
  }
}
