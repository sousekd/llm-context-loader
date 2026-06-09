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

Three cross-cutting changes enable the rest:

- **Content-typed body.** The pipeline body and `SourceDocument` carry a media type (Markdown and HTML now; PDF, DOCX, and images later). Steps act or skip based on it.
- **Fetch providers declare an output format.** Providers that can emit more than one format (Firecrawl, Docling) are configured for the format the pipeline wants, and tag the document they produce so later steps know what they received.
- **Deterministic transform steps.** Main-content extraction and HTML-to-Markdown conversion become composable steps that run only on a matching content type.

## Coming soon

The pivot above, sequenced so each step delivers value on its own and de-risks the next.

1. **Content-typed body and fetch output formats.** Add a media type to the body and `SourceDocument`; let Firecrawl and Docling return HTML and tag it. This is the keystone everything else builds on.
2. **Deterministic extract and convert steps.** First implementations: main-content extraction with Mozilla Readability (in-process, needs only a DOM such as linkedom) and HTML-to-Markdown with node-html-markdown or Turndown. Composed, these replace the LLM clean pass on the HTML path.
3. **Demote the LLM clean pass.** Once deterministic clean matches or beats it on representative URLs, make the clean stage optional and off by default. Keep summarize.
4. **Keep summaries honest.** Extend the existing URL quality gate from all-or-nothing rejection into a deterministic repair pass, and add fenced-code-block verification/repair for the summarize stage.

A couple of polish items ride along:

- **Configuration validation redesign.** Today every configured provider and step is constructed eagerly at compose time, so an unused source provider still requires its base URL and an unused LLM provider still requires its model. Redesign so providers and steps validate their config only when the active pipeline references them.
- **Diagnostics footer cleanup.** Consolidate the `<loader_info ... />` payload for consistency and readability.
- **Better defaults and prompts.** Test and tune the shipped defaults and prompts.

## Short term

Near-term additions once the pivot above settles.

- **Playwright fetch provider (HTML/DOM)** to remove the hard dependency on a running Firecrawl or Docling instance for HTML pages.
- **Handling non-HTML, non-Markdown content in the pipeline** for configurations without a conversion-capable fetch provider.
- **`ContentTransformer` provider category.** Once a second extractor or converter implementation exists, promote the transform steps into a named provider category so the choice is plug-and-play in YAML. Candidate implementations: Readability, node-html-markdown, Turndown, and Trafilatura behind a small service.

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
