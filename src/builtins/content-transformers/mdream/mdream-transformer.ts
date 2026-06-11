/**
 * Converts HTML bodies to Markdown using the pure-JS mdream engine.
 *
 * `htmlToMarkdown` is synchronous and has no native dependencies. The instance
 * passes the source URL as the mdream `origin` so relative links and images
 * resolve to absolute URLs. The `minimal` preset additionally isolates main
 * content and filters boilerplate; `clean` applies link and whitespace cleanup.
 */

import { htmlToMarkdown, withMinimalPreset, type MdreamOptions } from "@mdream/js";

import { InternalError } from "../../../shared/errors.js";
import { isHtmlMediaType, mediaTypes } from "../../../shared/media-types.js";

import type {
  ContentTransformDiagnostic,
  ContentTransformRequest,
  ContentTransformResult,
  ContentTransformer
} from "../../../contracts/extensions/content-transformer.js";
import type { BodyContent } from "../../../contracts/pipeline/context.js";
import type { Logger } from "../../../shared/logger.js";
import type { MdreamTransformerConfig } from "./mdream-transformer-config.js";

/** Transforms HTML text bodies into Markdown via mdream. */
export class MdreamTransformer implements ContentTransformer {
  /** Creates an mdream transformer instance. */
  constructor(
    private readonly config: MdreamTransformerConfig,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Supports HTML or XHTML text bodies targeting Markdown output. */
  supports(input: {
    readonly sourceKind: BodyContent["kind"];
    readonly sourceMediaType: string;
    readonly request: ContentTransformRequest;
  }): boolean {
    return (
      input.sourceKind === "text" &&
      isHtmlMediaType(input.sourceMediaType) &&
      input.request.targetMediaType === mediaTypes.markdown
    );
  }

  /** Renders the HTML body to Markdown, preserving the source title. */
  async transform(
    input: { readonly url: string; readonly body: BodyContent; readonly request: ContentTransformRequest },
    opts: { readonly signal: AbortSignal }
  ): Promise<ContentTransformResult> {
    opts.signal.throwIfAborted();
    const body = input.body;
    if (body.kind !== "text")
      throw new InternalError("mdream transformer requires a text body", "mdream_non_text_body");

    const markdown = htmlToMarkdown(body.content, this.buildOptions(input.url)).trim();
    const diagnostics: ContentTransformDiagnostic[] = [
      { code: "mdream", message: `${body.content.length} html chars -> ${markdown.length} markdown chars` }
    ];
    if (!markdown) diagnostics.push({ code: "empty_output" });

    return {
      body: { kind: "text", mediaType: mediaTypes.markdown, content: markdown, title: body.title },
      diagnostics
    };
  }

  /** Builds mdream options from instance config, threading the source URL. */
  private buildOptions(origin: string): Partial<MdreamOptions> {
    const base: Partial<MdreamOptions> = { origin };
    return this.config.minimal ? withMinimalPreset(base) : { ...base, clean: this.config.clean };
  }
}
