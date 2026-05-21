import type { AppConfig } from "../../config/config.js";
import type { FetchFooter, FooterInfo, FooterReturned, StageFooter, TruncateFooter } from "../cleanup/debug-footer.js";
import type { TemplateRenderer } from "../cleanup/templates.js";
import type { FetchProvider } from "../ports/fetch-provider.js";
import type { ContextDocument, FetchedDocument } from "../types.js";
import type { Limiters } from "../util/limiters.js";
import type { Logger } from "../util/logger.js";
import type { LlmStage } from "./llm-stage/llm-stage.js";

import { appendFooter } from "../cleanup/debug-footer.js";
import { compactChars } from "../cleanup/length-policy.js";
import { truncate } from "../cleanup/truncate.js";
import { AppError, messageFromError, reasonFromError } from "../util/errors.js";
import { validateHttpUrl } from "../util/urls.js";

// Primary application use-case for URL-to-context orchestration.
// Pipeline order is fixed: fetch -> clean -> summarize -> truncate -> footer.

export interface LoadContextDeps {
  config: AppConfig;
  logger: Logger;
  limiters: Limiters;
  fetchProvider: FetchProvider;
  cleanStage: LlmStage;
  summarizeStage: LlmStage;
  llmProviderName: string;
  templateRenderer: TemplateRenderer;
}

interface PipelineState {
  /** Best available content as the pipeline advances through stages. */
  content: string;

  /** Current returned-state tag mirrored into footer metadata. */
  returned: FooterReturned;
}

export class LoadContextUseCase {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly limiters: Limiters;
  private readonly fetchProvider: FetchProvider;
  private readonly cleanStage: LlmStage;
  private readonly summarizeStage: LlmStage;
  private readonly llmProviderName: string;
  private readonly templateRenderer: TemplateRenderer;

  /** Construct the URL loading use-case from configured collaborators. */
  constructor(deps: LoadContextDeps) {
    this.config = deps.config;
    this.logger = deps.logger;
    this.limiters = deps.limiters;
    this.fetchProvider = deps.fetchProvider;
    this.cleanStage = deps.cleanStage;
    this.summarizeStage = deps.summarizeStage;
    this.llmProviderName = deps.llmProviderName;
    this.templateRenderer = deps.templateRenderer;
  }

  /** Load and process many URLs concurrently through shared limiters. */
  async loadMany(urls: string[]): Promise<ContextDocument[]> {
    return Promise.all(urls.map((url) => this.loadOne(url)));
  }

  /** Load and process one URL through fetch, stages, truncation, and footer. */
  async loadOne(rawUrl: string): Promise<ContextDocument> {
    const url = validateHttpUrl(rawUrl);
    const started = Date.now();

    let fetched: FetchedDocument;
    let fetchDurationMs: number;
    try {
      const fetchStarted = Date.now();
      fetched = await this.limiters.fetch(() => this.fetchProvider.fetch(url));
      fetchDurationMs = Date.now() - fetchStarted;
    } catch (error) {
      return this.handleFetchFailure(url, error, started);
    }

    const fetchFooter: FetchFooter = {
      status: "ok",
      durationMs: fetchDurationMs,
      chars: compactChars(fetched.markdown)
    };

    const state: PipelineState = { content: fetched.markdown, returned: "source" };
    const stages: FooterInfo["stages"] = {};

    await this.limiters.llm(async () => {
      const cleanResult = await this.cleanStage.run({
        url: fetched.url,
        title: fetched.title,
        content: state.content
      });
      stages.clean = cleanResult.footer;
      if (cleanResult.accepted) {
        state.content = cleanResult.output;
        state.returned = "clean";
      }

      const summarizeResult = await this.summarizeStage.run({
        url: fetched.url,
        title: fetched.title,
        content: state.content
      });
      stages.summarize = summarizeResult.footer;
      if (summarizeResult.accepted) {
        state.content = summarizeResult.output;
        state.returned = "summary";
      }
    });

    const truncateResult = truncate(state.content, this.config.TRUNCATE_TARGET_CHARS);
    state.content = truncateResult.output;
    const truncateFooter: TruncateFooter = {
      applied: truncateResult.truncated,
      originalChars: truncateResult.originalChars,
      outputChars: truncateResult.outputChars
    };
    stages.truncate = truncateFooter;
    if (truncateResult.truncated) state.returned = "truncated";

    const finalChars = state.content.length;
    const footerInfo: FooterInfo = {
      returned: state.returned,
      sourceUrl: fetched.url,
      title: fetched.title,
      finalChars,
      fetchProvider: this.fetchProvider.name,
      llmProvider: this.llmProviderName,
      fetch: fetchFooter,
      stages
    };

    const pageContent = await this.appendFooterIfEnabled(state.content, footerInfo);

    this.logger.info({
      event: "context.loaded",
      url,
      returned: state.returned,
      finalChars,
      fetchChars: fetchFooter.chars,
      cleanStatus: stages.clean?.status,
      summarizeStatus: stages.summarize?.status,
      truncated: truncateFooter.applied,
      durationMs: Date.now() - started
    });

    return {
      pageContent,
      metadata: this.buildMetadata(fetched.url, fetched.title, footerInfo)
    };
  }

  /** Build an error response or throw when fetch fails before content exists. */
  private async handleFetchFailure(
    url: string,
    error: unknown,
    started: number
  ): Promise<ContextDocument> {
    const reason = reasonFromError(error);
    const message = messageFromError(error);
    const event =
      error instanceof AppError && (error.code === "invalid_url" || error.code === "unsupported_url_scheme")
        ? "context.invalid_url"
        : "context.fetch_failed";

    this.logger.warn({ event, url, reason, err: error, durationMs: Date.now() - started });

    if (!this.config.DIAGNOSTIC_FOOTER_ENABLED) throw error;

    const body = `Failed to fetch URL: ${url}`;
    const footerInfo: FooterInfo = {
      returned: "error",
      sourceUrl: url,
      finalChars: body.length,
      fetchProvider: this.fetchProvider.name,
      llmProvider: this.llmProviderName,
      fetch: { status: reason, durationMs: Date.now() - started, chars: 0 },
      stages: {},
      error: message.slice(0, 300)
    };
    const footer = await this.templateRenderer.renderFooter(footerInfo);
    const pageContent = appendFooter(body, footer);

    return {
      pageContent,
      metadata: this.buildMetadata(url, undefined, { ...footerInfo, finalChars: pageContent.length })
    };
  }

  /** Append diagnostic footer content when footer output is enabled. */
  private async appendFooterIfEnabled(content: string, footerInfo: FooterInfo): Promise<string> {
    if (!this.config.DIAGNOSTIC_FOOTER_ENABLED) return content;
    const footer = await this.templateRenderer.renderFooter(footerInfo);
    return appendFooter(content, footer);
  }

  /** Map footer information to JSON metadata contract for clients. */
  private buildMetadata(url: string, title: string | undefined, footer: FooterInfo): ContextDocument["metadata"] {
    const stages: ContextDocument["metadata"]["stages"] = {};
    if (footer.stages.clean) stages.clean = footer.stages.clean satisfies StageFooter;
    if (footer.stages.summarize) stages.summarize = footer.stages.summarize satisfies StageFooter;
    if (footer.stages.truncate) stages.truncate = footer.stages.truncate satisfies TruncateFooter;
    return {
      source: url,
      title,
      loader: "llm-context-loader",
      fetchProvider: this.fetchProvider.name,
      llmProvider: this.llmProviderName,
      returned: footer.returned,
      finalChars: footer.finalChars,
      fetch: footer.fetch,
      stages,
      error: footer.error
    };
  }
}
