# Roadmap

This file records scope boundaries and the rough direction of this tool.
It is the place to check and update before and after adding features.

## Vision

A self-hosted, cloud-free tool for loading content from URLs and giving the calling model exactly what it needs for the task at hand — without polluting the caller's context with boilerplate, navigation, or unrelated noise. Built for local LLM usage on limited hardware, where every token in the context window matters.

## Current scope

Implemented today:

- `POST /` for Open WebUI's external web-loader contract.
- `GET /r/<url>` and `GET /r?url=<url>` for limited Jina Reader-style URL-to-markdown compatibility.
- Firecrawl fetch provider using `/v2/scrape` with markdown output.
- OpenAI-compatible Chat Completions LLM provider.
- Optional clean stage, optional summarize stage, final truncation, and XML diagnostic footer.
- Docker image published by CI to GHCR.

Current provider implementations are intentionally few. The interfaces exist so replacements can be added without rewriting the use case.

## Coming soon

Improving what already exists before adding new surface area.

- **URL hallucination repair.** The current quality gate already rejects stage output that introduces URLs absent from the source. Replace that all-or-nothing check with a deterministic repair pass.
- **Diagnostics footer cleanup.** Consolidate the `<context_loader_info ... />` payload for consistency and readability.
- **Better defaults and prompts.** Iterate on clean/summarize system prompts and the default length budgets (`CLEAN_*`, `SUMMARIZE_*`, `TRUNCATE_TARGET_CHARS`).

## Short term

Near-term additions once the current refinement pass settles.

- **CLI** for terminal-preferring agents.
- **MCP server for existing functionality.** Existing URL-to-context flow only.
- **In-memory telemetry and simple UI.** Opt-in, in-memory statistics and recent request data for easier debugging.

## Mid term

Larger pieces that expand what the service can do without changing the core philosophy.

- **Playwright fetch provider** to remove the hard dependency on a running Firecrawl instance, followed by:
    - A fallback chain across fetch providers, optionally including cloud services such as Jina for those who want them rather than failing.
- **MCP server client, expanded modes**, delivered in stages:
    1. Add explicit modes: "give me an overview + index of this URL", "extract specific information from this URL".
    2. Smart staged response: return short pages in full; for long pages return overview + index and prompt the caller to ask for specific sections.
    3. Cache fetched pages to support the staged flow without repeated upstream calls.
- **Configurable fetch pipelines** via a YAML config: ordered steps of typed stages (fetch, clean, summarize, extract, …), per-step run conditions, pre- and post-checks, support for different models or providers. Make the existing hard-coded pipeline declarative & customizable.
- **Persistent stage telemetry.** Optional store for per-stage statistics and request data after the pipeline model is clear.

## Long term

Directions worth pursuing for broader usability.

- **Non-HTML content handling:**
    - URLs pointing at documents (PDF, Office) handled via external tools such as Docling.
    - Image content surfaced via transcription/OCR.

## Speculative / far future

- Indexing, chunking, and RAG over long content, kept behind the same URL-in / context-out contract.
- Dynamically maintained local knowledge base / wiki built from pages flowing through the fetch pipeline.
