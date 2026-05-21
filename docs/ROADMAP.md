# Roadmap

This file records scope boundaries for this small service. It is not a promise of future work; it is the place to check before adding features that change the shape of the project.

## Current scope

Implemented today:

- `POST /` for Open WebUI's external web-loader contract.
- `GET /r/<url>` and `GET /r?url=<url>` for limited Jina Reader-style URL-to-markdown compatibility.
- Firecrawl fetch provider using `/v2/scrape` with markdown output.
- OpenAI-compatible Chat Completions LLM provider.
- Optional clean stage, optional summarize stage, final truncation, and XML diagnostic footer.
- Docker image published by CI to GHCR.

Current provider implementations are intentionally few. The interfaces exist so replacements can be added without rewriting the use case.

## Deferred until needed

Do not implement these without updating this file, [README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [AGENTS.md](../AGENTS.md) as needed:

- Additional fetch providers such as Crawl4AI, Playwright, or direct HTTP.
- Document providers for PDF/Office extraction, likely around Docling.
- MCP server client tools such as `load_url`, `ask_url`, or `extract_fields`.
- CLI client.
- Ask/extract modes that answer a question about a page instead of returning cleaned page context.
- Durable queues, databases, persistent operational logs, or admin UI.
- Chunking, indexing, retrieval, or embedding storage.

## Non-goals

- Replacing Firecrawl, Crawl4AI, Docling, model servers, or Open WebUI.
- Becoming a general crawler, parser, model gateway, or RAG framework.
- Adding LangChain, LlamaIndex, LiteLLM, Vercel AI SDK, NestJS, Express, Redis/BullMQ, or a Python runtime inside this service.
- Adding hidden model-routing behavior. LLM calls should remain explicit and boring.
