import type { AppConfig } from "../../src/config/config.js";
import type { FooterInfo } from "../../src/core/cleanup/debug-footer.js";
import type { LoadContextUseCase } from "../../src/core/use-cases/load-context.js";
import type { FetchProvider } from "../../src/core/ports/fetch-provider.js";
import type {
  LlmChatOptions,
  LlmChatResult,
  LlmMessage,
  LlmProvider
} from "../../src/core/ports/llm-provider.js";
import type { ContextDocument, FetchedDocument } from "../../src/core/types.js";
import {
  LlmStage,
  cleanConfigFromAppConfig,
  summarizeConfigFromAppConfig,
  type LlmStageConfig
} from "../../src/core/use-cases/llm-stage/llm-stage.js";
import type { TemplateRenderer } from "../../src/core/cleanup/templates.js";

// Hand-rolled stubs (no `vi.fn()`) for the ports + use cases. Each helper
// returns the stub plus a `calls` record so tests can both inject behaviour
// and inspect what happened.

export interface FetchProviderStubOptions {
  name?: string;
  fetch?: (url: string) => Promise<FetchedDocument>;
  defaultMarkdown?: string;
  defaultTitle?: string;
}

export type FetchedDocumentOverrides = Partial<FetchedDocument>;

export function makeFetchedDoc(overrides: FetchedDocumentOverrides = {}): FetchedDocument {
  const url = overrides.url ?? "https://example.com/";
  return {
    url,
    title: "Example",
    markdown: "source body ".repeat(200),
    ...overrides
  };
}

export function makeFetchProviderStub(opts: FetchProviderStubOptions = {}): {
  provider: FetchProvider;
  calls: string[];
} {
  const calls: string[] = [];
  const name = opts.name ?? "stub_fetch";
  const defaultMarkdown = opts.defaultMarkdown ?? "source body ".repeat(200);
  const defaultTitle = opts.defaultTitle ?? "T";
  const provider: FetchProvider = {
    name,
    async fetch(url) {
      calls.push(url);
      if (opts.fetch) return opts.fetch(url);
      return { url, title: defaultTitle, markdown: defaultMarkdown };
    }
  };
  return { provider, calls };
}

export interface LlmProviderStubOptions {
  name?: string;
  chat?: (messages: LlmMessage[], options?: LlmChatOptions) => Promise<LlmChatResult>;
  defaultText?: string;
  defaultModel?: string;
}

export interface LlmCall {
  messages: LlmMessage[];
  options?: LlmChatOptions;
}

export function makeLlmProviderStub(opts: LlmProviderStubOptions = {}): {
  provider: LlmProvider;
  calls: LlmCall[];
} {
  const calls: LlmCall[] = [];
  const name = opts.name ?? "stub_llm";
  const defaultText = opts.defaultText ?? "cleaned";
  const defaultModel = opts.defaultModel ?? "stub-model";
  const provider: LlmProvider = {
    name,
    async chat(messages, options) {
      calls.push({ messages: [...messages], options });
      if (opts.chat) return opts.chat(messages, options);
      return { text: defaultText, model: defaultModel };
    }
  };
  return { provider, calls };
}

export interface StageStubOptions {
  /** Override config (defaults to {@link cleanConfigFromAppConfig}). */
  config?: LlmStageConfig;
  /** Pass `false` to use the summarize-stage defaults instead of clean. */
  summarize?: boolean;
}

// Build a real `LlmStage` against a stub LLM provider, so the orchestration
// layer can be tested without re-implementing the stage's eligibility /
// quality logic.
export function makeStage(
  app: AppConfig,
  templates: TemplateRenderer,
  llm: LlmProvider,
  opts: StageStubOptions = {}
): LlmStage {
  const config =
    opts.config ?? (opts.summarize ? summarizeConfigFromAppConfig(app) : cleanConfigFromAppConfig(app));
  return new LlmStage({ config, app, llm, templates });
}

export interface UseCaseStubOptions {
  loadOne?: (url: string) => Promise<ContextDocument>;
  loadMany?: (urls: string[]) => Promise<ContextDocument[]>;
  docFor?: (url: string) => ContextDocument;
  forbidLoadMany?: boolean;
}

export interface UseCaseStubCalls {
  loadOne: string[];
  loadMany: string[][];
}

export function makeUseCaseStub(opts: UseCaseStubOptions = {}): {
  useCase: LoadContextUseCase;
  calls: UseCaseStubCalls;
} {
  const calls: UseCaseStubCalls = { loadOne: [], loadMany: [] };
  const docFor = opts.docFor ?? defaultContextDocument;
  const useCase = {
    async loadOne(url: string) {
      calls.loadOne.push(url);
      if (opts.loadOne) return opts.loadOne(url);
      return docFor(url);
    },
    async loadMany(urls: string[]) {
      calls.loadMany.push([...urls]);
      if (opts.forbidLoadMany) throw new Error("loadMany was not expected");
      if (opts.loadMany) return opts.loadMany(urls);
      return urls.map(docFor);
    }
  } as unknown as LoadContextUseCase;
  return { useCase, calls };
}

export type ContextDocumentOverrides = Partial<Omit<ContextDocument, "metadata">> & {
  metadata?: Partial<ContextDocument["metadata"]> & {
    fetch?: Partial<ContextDocument["metadata"]["fetch"]>;
    stages?: Partial<ContextDocument["metadata"]["stages"]>;
  };
};

export function makeContextDoc(url = "https://example.com/", overrides: ContextDocumentOverrides = {}): ContextDocument {
  const pageContent = overrides.pageContent ?? `MD for ${url}`;
  const metadataOverrides = overrides.metadata ?? {};
  return {
    pageContent,
    metadata: {
      source: url,
      title: "Example",
      loader: "llm-context-loader",
      fetchProvider: "stub_fetch",
      llmProvider: "stub_llm",
      returned: "clean",
      finalChars: pageContent.length,
      ...metadataOverrides,
      fetch: { status: "ok", durationMs: 0, chars: 10, ...metadataOverrides.fetch },
      stages: { ...metadataOverrides.stages }
    }
  };
}

export type FooterInfoOverrides = Partial<Omit<FooterInfo, "fetch" | "stages">> & {
  fetch?: Partial<FooterInfo["fetch"]>;
  stages?: Partial<FooterInfo["stages"]>;
};

export function makeFooterInfo(overrides: FooterInfoOverrides = {}): FooterInfo {
  return {
    returned: "clean",
    sourceUrl: "https://example.com/",
    title: "Example",
    finalChars: 100,
    fetchProvider: "stub_fetch",
    llmProvider: "stub_llm",
    ...overrides,
    fetch: { status: "ok", durationMs: 1, chars: 100, ...overrides.fetch },
    stages: { ...overrides.stages }
  };
}

function defaultContextDocument(url: string): ContextDocument {
  return makeContextDoc(url, { metadata: { title: undefined } });
}
