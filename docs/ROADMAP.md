# Roadmap

This file records scope boundaries and the rough direction of this tool.
It is the place to check and update before and after adding features.

## Vision

A self-hosted, cloud-free tool for loading content from URLs and giving the calling model exactly what it needs for the task at hand — without polluting the caller's context with boilerplate, navigation, or unrelated noise. Built for local LLM usage on limited hardware, where every token in the context window matters.

## Current scope

Implemented today:

- `POST /` for Open WebUI's external web-loader contract.
- `GET /r/<url>` and `GET /r?url=<url>` for limited Jina Reader-style URL-to-markdown compatibility.
- Firecrawl source provider using `/v2/scrape` with markdown, html, and rawHtml output.
- Docling source provider (experimental, PDFs and Office docs → markdown via Docling Serve API).
- Deterministic content transformers: Readability (article extraction) and mdream (HTML → markdown).
- Optional LLM clean stage, optional LLM summarize stage, final truncation, and XML diagnostic footer.
- YAML-driven configuration for pipelines, providers, content transformers, output renderers, and HTTP adapters.
- Docker image published by CI to GHCR.

Current provider implementations are intentionally few. The interfaces exist so replacements can be added without rewriting the use case.

## Direction

Deterministic extraction (readability + mdream) handles most pages in milliseconds. The next step is to make the pipeline self-aware: route through deterministic or LLM paths based on URL heuristics and per-step signals, reserving LLM passes for pages that need them.

## Coming soon

1. **Conditional step execution based on signals.** Engine-level `skipIfSignal` / `runIfSignal` configuration on pipeline steps. When a signal name is set and the condition is met, the step is skipped entirely without running.
2. **URL heuristic step to classify input.** A pipeline step that matches the URL against patterns (path, domain, expected content type) and sets runtime signals for downstream steps. Use the feature to avoid Readibility step on GitHub domain etc.
3. **Route binary content to Docling.** Use the Docling source provider based on URL heuristics as an alternative to Firecrawl for PDFs and other binary content.
4. **Keep summaries honest.** Extend the existing URL quality gate from all-or-nothing rejection into a deterministic repair pass, and implement fenced-code-block verification/repair.

A couple of polish items ride along:

- **Diagnostics footer cleanup.** Consolidate the `<loader_info ... />` payload for consistency and readability.
- **Better defaults and prompts.** Test and tune the shipped defaults and prompts.

## Short term

Near-term additions once the pivot above settles.

- **Playwright source provider** to remove the hard dependency on a running Firecrawl instance for HTML pages.
- **Docling content transformer** to convert PDFs, Office documents, and other document-type files to markdown.
- **Crawl4AI source provider** as a potentially better alternative to Firecrawl.

## Mid term

Larger pieces that expand what the service can do without changing the core philosophy.

- **MCP server**, delivered in stages:
  1. Existing URL-to-context flow only.
  2. Add explicit modes: "give me an overview + index of this URL", "extract specific information from this URL".
  3. Smart staged response: return short pages in full; for long pages return overview + index and prompt the caller to ask for specific sections.
  4. Cache fetched pages to support the staged flow without repeated upstream calls.
- **CLI** for terminal-preferring agents.
- **In-memory telemetry and simple UI.** Opt-in, in-memory statistics and recent request data for easier debugging.

These should build over `EngineRuntime` or host-level services. They should not reread YAML to infer runtime state and should not create a parallel provider/pipeline construction path.

## Long term

Directions worth pursuing for broader usability.

- **Persistent stage telemetry.** Optional store for per-stage statistics and request data.

Persistence should attach through typed host services, observers, or explicit app-level orchestration. Core pipeline code should not grow direct database writes.

## Speculative

- Indexing, chunking, and RAG over long content, kept behind the same URL-in / context-out contract.
- Dynamically maintained local knowledge base / wiki built from pages flowing through the fetch pipeline.
