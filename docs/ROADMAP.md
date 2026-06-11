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
- YAML-driven configuration for pipelines, providers, output renderers, and HTTP adapters.
- Docker image published by CI to GHCR.

Current provider implementations are intentionally few. The interfaces exist so replacements can be added without rewriting the use case.

## Direction

The biggest usability problem today is speed. Running every page through one or two LLM passes just to strip boilerplate is slow on limited hardware and invites hallucination. Most pages do not need a model to become clean Markdown.

The direction is to make the default path deterministic and reserve the LLM for work only a model does well:

```text
fetch (HTML or Markdown)
  -> [HTML] extract main content
  -> [HTML] convert HTML -> Markdown
  -> [optional] LLM summarize / index
  -> keep-honest repair (URLs, code blocks)
  -> truncate to budget
```

The URL-in / clean-Markdown-within-a-budget contract does not change. What changes is how the middle is done: established extraction and conversion tools instead of a model. We own the plumbing — content-type routing, budgets, honesty gates — and the surfaces — HTTP/MCP/CLI, observability, caching. We do not write our own readability heuristics or HTML parser.

## Coming soon

1. **In-process main-content extraction.** A new pipeline step that extracts content from HTML using Readability. This creates a fully deterministic HTML-to-markdown path with no external service dependency for boilerplate removal.
2. **Demote the LLM clean pass.** Once deterministic clean matches or beats it on representative URLs, make the clean stage optional and only execute it for URLs where deterministic clean did not produce desired results. Keep summarize.
3. **Keep summaries honest.** Extend the existing URL quality gate from all-or-nothing rejection into a deterministic repair pass, and implement fenced-code-block verification/repair.

A couple of polish items ride along:

- **Diagnostics footer cleanup.** Consolidate the `<loader_info ... />` payload for consistency and readability.
- **Better defaults and prompts.** Test and tune the shipped defaults and prompts.

## Short term

Near-term additions once the pivot above settles.

- **Playwright fetch provider (HTML/DOM)** to remove the hard dependency on a running Firecrawl instance for HTML pages.
- **Docling for document conversion.** Use Docling to convert PDFs, Office documents, and other document-type files to markdown.

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
