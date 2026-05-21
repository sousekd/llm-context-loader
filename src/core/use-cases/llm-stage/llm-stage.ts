import type { AppConfig } from "../../../config/config.js";
import type { StageFooter, StageStatus } from "../../cleanup/debug-footer.js";
import type { QualityRejectReason } from "../../cleanup/quality-gate.js";
import type { TemplateRenderer } from "../../cleanup/templates.js";
import type { LlmProvider } from "../../ports/llm-provider.js";

import { checkEligibility, compactChars, estimateTokens } from "../../cleanup/length-policy.js";
import { assessQuality } from "../../cleanup/quality-gate.js";
import { reasonFromError } from "../../util/errors.js";

// One configurable stage in the LLM pipeline, reused for clean and summarize.
// Stage execution never throws; failures are returned as structured stage results.

export type StageName = "clean" | "summarize";

export interface LlmStageConfig {
  name: StageName;

  /** Success status written to diagnostics when output is accepted. */
  successStatus: Extract<StageStatus, "cleaned" | "summarized">;
  enabled: boolean;
  minInputChars: number;
  maxInputChars: number;
  outputRatio: number;
  timeoutMs: number;
  qualityMinRatio: number;
  checkUrls: boolean;
  systemTemplate: string;
  userTemplate: string;
}

export interface LlmStageDeps {
  config: LlmStageConfig;
  app: Pick<AppConfig, "LLM_CONTEXT_TOKENS" | "LLM_CHARS_PER_TOKEN">;
  llm: LlmProvider;
  templates: TemplateRenderer;
}

export interface LlmStageInput {
  url: string;
  title?: string;
  content: string;
}

export interface LlmStageAcceptedResult {
  accepted: true;
  output: string;
  footer: StageFooter;
}

export interface LlmStageRejectedResult {
  accepted: false;
  footer: StageFooter;
}

export type LlmStageResult = LlmStageAcceptedResult | LlmStageRejectedResult;

export class LlmStage {
  /** Create a stage runner from resolved stage dependencies and config. */
  constructor(private readonly deps: LlmStageDeps) { }

  /** Return this stage name for diagnostics and wiring. */
  get name(): StageName {
    return this.deps.config.name;
  }

  /** Return whether this stage is currently enabled. */
  get enabled(): boolean {
    return this.deps.config.enabled;
  }

  /**
   * Run one stage: eligibility check, prompt render, LLM call, and quality gate.
   * Returns accepted output or a structured rejection without throwing.
   */
  async run(input: LlmStageInput): Promise<LlmStageResult> {
    const config = this.deps.config;
    const started = Date.now();
    const inputChars = compactChars(input.content);

    const eligibility = checkEligibility({
      enabled: config.enabled,
      inputChars,
      minInputChars: config.minInputChars,
      maxInputChars: config.maxInputChars,
      contextTokens: this.deps.app.LLM_CONTEXT_TOKENS,
      charsPerToken: this.deps.app.LLM_CHARS_PER_TOKEN,
      outputRatio: config.outputRatio
    });

    if (eligibility.kind !== "eligible") {
      const status: StageStatus = eligibility.kind;
      return {
        accepted: false,
        footer: {
          status,
          durationMs: Date.now() - started,
          inputChars
        }
      };
    }

    const view = { url: input.url, title: input.title, content: input.content };
    let systemPrompt: string;
    let userPrompt: string;
    try {
      [systemPrompt, userPrompt] = await Promise.all([
        this.deps.templates.render(config.systemTemplate, view),
        this.deps.templates.render(config.userTemplate, view)
      ]);
    } catch (error) {
      return {
        accepted: false,
        footer: {
          status: "llm_failed",
          durationMs: Date.now() - started,
          inputChars,
          reason: reasonFromError(error)
        }
      };
    }

    const inputTokens = estimateTokens(inputChars, this.deps.app.LLM_CHARS_PER_TOKEN);
    const maxTokens = Math.max(1, Math.floor(inputTokens * config.outputRatio));

    let text: string;
    let model: string | undefined;
    try {
      const result = await this.deps.llm.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        {
          maxTokens,
          timeoutMs: config.timeoutMs
        }
      );
      text = result.text;
      model = result.model;
    } catch (error) {
      const reason = reasonFromError(error);
      const status: StageStatus = reason === "timeout" || reason === "llm_timeout" ? "timeout" : "llm_failed";
      return {
        accepted: false,
        footer: {
          status,
          durationMs: Date.now() - started,
          inputChars,
          reason
        }
      };
    }

    const quality = assessQuality(input.content, text, {
      minRatio: config.qualityMinRatio,
      checkUrls: config.checkUrls
    });

    if (!quality.ok) {
      return {
        accepted: false,
        footer: {
          status: "quality_rejected",
          durationMs: Date.now() - started,
          inputChars: quality.sourceChars,
          outputChars: quality.outputChars,
          ratio: quality.ratio,
          reason: quality.reason as QualityRejectReason,
          model
        }
      };
    }

    return {
      accepted: true,
      output: text,
      footer: {
        status: config.successStatus,
        durationMs: Date.now() - started,
        inputChars: quality.sourceChars,
        outputChars: quality.outputChars,
        ratio: quality.ratio,
        model
      }
    };
  }
}

/** Map app config into clean-stage configuration values. */
export function cleanConfigFromAppConfig(config: AppConfig): LlmStageConfig {
  return {
    name: "clean",
    successStatus: "cleaned",
    enabled: config.CLEAN_ENABLED,
    minInputChars: config.CLEAN_MIN_INPUT_CHARS,
    maxInputChars: config.CLEAN_MAX_INPUT_CHARS,
    outputRatio: config.CLEAN_OUTPUT_RATIO,
    timeoutMs: config.CLEAN_TIMEOUT_SECONDS * 1000,
    qualityMinRatio: config.CLEAN_QUALITY_MIN_RATIO,
    checkUrls: config.CLEAN_CHECK_URLS,
    systemTemplate: config.CLEAN_SYSTEM_TEMPLATE,
    userTemplate: config.CLEAN_USER_TEMPLATE
  };
}

/** Map app config into summarize-stage configuration values. */
export function summarizeConfigFromAppConfig(config: AppConfig): LlmStageConfig {
  return {
    name: "summarize",
    successStatus: "summarized",
    enabled: config.SUMMARIZE_ENABLED,
    minInputChars: config.SUMMARIZE_MIN_INPUT_CHARS,
    maxInputChars: config.SUMMARIZE_MAX_INPUT_CHARS,
    outputRatio: config.SUMMARIZE_OUTPUT_RATIO,
    timeoutMs: config.SUMMARIZE_TIMEOUT_SECONDS * 1000,
    qualityMinRatio: config.SUMMARIZE_QUALITY_MIN_RATIO,
    checkUrls: config.SUMMARIZE_CHECK_URLS,
    systemTemplate: config.SUMMARIZE_SYSTEM_TEMPLATE,
    userTemplate: config.SUMMARIZE_USER_TEMPLATE
  };
}
