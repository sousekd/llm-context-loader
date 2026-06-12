/**
 * Extracts main article HTML from raw HTML using Mozilla Readability.
 *
 * Given a raw HTML page, this transformer first checks whether the document
 * *seems* readerable via `isProbablyReaderable`. If not, it returns a
 * "declined" outcome so the pipeline can fall through to downstream steps
 * unchanged. If the gate passes, the document is parsed with Readability to
 * extract the article content. The output is *still HTML* (not markdown), so
 * another transformer (typically mdream) further downstream converts it.
 */

import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import { InternalError } from "../../../shared/errors.js";
import { isHtmlMediaType, mediaTypes } from "../../../shared/media-types.js";

import type { ContentTransformResult, ContentTransformer } from "../../../contracts/extensions/content-transformer.js";
import type { BodyContent } from "../../../contracts/pipeline/context.js";
import type { Logger } from "../../../shared/logger.js";
import type { ReadabilityTransformerConfig } from "./readability-transformer-config.js";

/** Transforms raw HTML text bodies into cleaned article HTML via Readability. */
export class ReadabilityTransformer implements ContentTransformer {
  /** Creates a Readability transformer instance. */
  constructor(
    private readonly config: ReadabilityTransformerConfig,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Supports HTML or XHTML text bodies targeting HTML output. */
  supports(input: {
    readonly sourceKind: BodyContent["kind"];
    readonly sourceMediaType: string;
    readonly request: { readonly targetMediaType: string };
  }): boolean {
    return (
      input.sourceKind === "text" &&
      isHtmlMediaType(input.sourceMediaType) &&
      input.request.targetMediaType === mediaTypes.html
    );
  }

  /** Attempts to extract article content; declines when the page isn't article-like. */
  async transform(
    input: { readonly url: string; readonly body: BodyContent; readonly request: { readonly targetMediaType: string } },
    opts: { readonly signal: AbortSignal }
  ): Promise<ContentTransformResult> {
    opts.signal.throwIfAborted();

    const body = input.body;
    if (body.kind !== "text")
      throw new InternalError("readability transformer requires a text body", "readability_non_text_body");

    const dom = parseHTML(body.content);
    const doc = dom.document as unknown as Document;

    if (!doc.documentElement) return { outcome: "declined", reason: "parse_empty" };

    if (
      !isProbablyReaderable(doc, {
        minContentLength: this.config.minContentLength,
        minScore: this.config.minScore
      })
    )
      return { outcome: "declined", reason: "not_readerable" };

    const article = new Readability(doc, { maxElemsToParse: this.config.maxElements || undefined }).parse();
    if (!article || !article.content) return { outcome: "declined", reason: "output_empty" };

    return {
      outcome: "transformed",
      body: {
        kind: "text",
        mediaType: mediaTypes.html,
        content: article.content,
        title: body.title || (article.title ?? undefined)
      }
    };
  }
}
