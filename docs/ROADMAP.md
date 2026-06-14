# Roadmap

This file records scope boundaries and the rough direction of this tool.
It is the place to check and update before and after adding features.

## Vision

A self-hosted, cloud-free tool for loading content from URLs and giving the calling model exactly what it needs for the task at hand — without polluting the caller's context with boilerplate, navigation, or unrelated noise. Built for local LLM usage on limited hardware, where every token in the context window matters.

## Current scope

Implemented today:

- `POST /` for Open WebUI's external web-loader contract.
- `GET /r/<url>` and `GET /r?url=<url>` for limited Jina Reader-style URL-to-markdown compatibility.
- Native HTTP, Firecrawl, and Docling source providers.
- Deterministic content transformers: Readability (article extraction) and mdream (HTML → markdown).
- Optional LLM clean stage, optional LLM summarize stage, final truncation, and XML diagnostic footer.
- YAML-driven configuration for pipelines, providers, content transformers, output renderers, and HTTP adapters.
- Docker image published by CI to GHCR.

Current provider implementations are intentionally few. The interfaces exist so replacements can be added without rewriting the use case.

## Coming soon

1. **Playwright source provider** to remove the hard dependency on a running Firecrawl instance for HTML pages.
2. **LLM pass auto-repair.** Repair URLs and code blocks, instead of mere detection.
3. **Diagnostics footer cleanup.** Consolidate the `<loader_info ... />` payload for consistency and readability.
4. **Better defaults and prompts.** Test and tune what ships.

## Short term

Near-term additions once the work above settles.

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
