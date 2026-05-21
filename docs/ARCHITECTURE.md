# Architecture

LLM Context Loader is a small Fastify service with one application use case: load a URL and return markdown context. The code is organized so HTTP client contracts, fetch providers, LLM providers, and domain orchestration stay separate and individually testable.

The high-level request flow is in the [README](../README.md#request-flow). This document focuses on the internals: how the code is laid out, where the seams are, and the rules that keep them stable.

## Runtime detail

The README diagram covers the happy path. The points worth knowing past that:

- `POST /` runs `LoadContextUseCase.loadMany`, but each URL flows through the same `loadOne` pipeline independently. A failure on one URL does not cancel the rest of an Open WebUI batch unless `DIAGNOSTIC_FOOTER_ENABLED=false` and the failure is a fetch failure.
- Fetches share a global `limiters.fetch` slot bounded by `FETCH_CONCURRENCY`.
- The entire per-URL LLM workflow (clean + summarize today, more stages later) runs inside a single `limiters.llm` slot bounded by `LLM_CONCURRENCY`. This keeps single-stream local model servers usable with `LLM_CONCURRENCY=1` even when several URLs are being processed at once.
- Truncation runs before the diagnostic footer is appended, so `TRUNCATE_TARGET_CHARS` caps the body only.
- Fetch failure returns a diagnostic document when `DIAGNOSTIC_FOOTER_ENABLED=true`; otherwise it throws.

## Source layout

```text
src/
  core/
    ports/                 # FetchProvider and LlmProvider interfaces
    cleanup/               # templates, length policy, quality gate, truncate, footer
    use-cases/             # LoadContextUseCase and LlmStage
    util/                  # errors, limiters, logger, URL helpers
    types.ts               # shared document and metadata shapes
  clients/
    openwebui/             # POST / adapter
    jina/                  # GET /r/<url> and GET /r?url=...
    auth.ts                # shared inbound bearer auth
    registry.ts            # CLIENTS parsing and CLIENT_REGISTRY
  providers/
    fetch/firecrawl/       # Firecrawl FetchProvider implementation and env schema
    llm/openai-chat/       # OpenAI-compatible Chat Completions provider
  config/config.ts         # core env schema
  composition.ts           # concrete wiring
  http.ts                  # Fastify app, error handler, GET /health
  main.ts                  # process entrypoint
templates/                 # Mustache prompts and footer
tests/                     # mirrors src/ with dependency-injected stubs
scripts/                   # local smoke helpers, not shipped in the Docker image
```

## Main boundaries

### Core

`src/core/` is framework-free domain code. It must not import Fastify, HTTP route adapters, concrete providers, or `src/composition.ts`. The core owns orchestration, fallback behavior, truncation, footer data, quality checks, and URL validation.

### Clients

`src/clients/<name>/` maps an external contract to the use case. Current clients are:

- `openwebui`: `POST /` with `{ "urls": [...] }`, returning Open WebUI document rows.
- `jina`: `GET /r/<url>` and `GET /r?url=<url>`, returning markdown.

The `CLIENTS` env variable chooses which client plugins are registered. Empty `CLIENTS` leaves only `/health`. Unknown names abort startup.

### Providers

Provider interfaces live in `src/core/ports/`. Concrete implementations live under `src/providers/<class>/<impl>/` and own their provider-specific env parsing through a `parseXxxEnv(env)` Zod schema in `*-env.ts`. This keeps provider keys next to their implementation; unrelated deployments never need to supply unrelated keys.

Current implementations:

- Fetch: `FirecrawlFetchProvider`, configured by `FIRECRAWL_*` keys.
- LLM: `OpenAiChatLlmProvider`, configured by shared `LLM_*` keys plus an empty provider-local schema for consistency.

The composition root is the only place that constructs providers.

### Composition root

`src/composition.ts` wires config, limiters, templates, concrete providers, LLM stages, the use case, and selected client plugins. Provider selection switches are intentionally small because there is one implementation per provider type today. If a provider slot gains several implementations, a registry map similar to `CLIENT_REGISTRY` is the natural next step.

## LLM stages

Clean and summarize are configured instances of the same `LlmStage` class — not subclasses. A stage does this work in order:

1. Check whether the stage is enabled and the compacted input length fits stage and context-window limits.
2. Render system and user templates with `{ url, title, content }`.
3. Call the LLM provider with Chat Completions messages using `system` and `user` roles only.
4. Run the deterministic quality gate.
5. Return either accepted output or a structured rejection footer.

Stage failures do not throw out of the stage. They return status data so the use case can keep the previous content.

If a future stage diverges structurally (different inputs, multiple calls, tool use), create a sibling class rather than subclassing `LlmStage`. Sibling classes beat inheritance trees.

## Fallback model

The pipeline keeps the best available content as it advances:

- Initial content is Firecrawl markdown.
- Accepted clean output replaces source markdown and sets `returned="clean"`.
- Accepted summarize output replaces current content and sets `returned="summary"`.
- Rejected, skipped, failed, or timed-out stages keep the previous content.
- Truncation, when applied, sets `returned="truncated"`.
- Fetch failure returns a diagnostic document when `DIAGNOSTIC_FOOTER_ENABLED=true`, otherwise it throws.

The diagnostic footer is appended after truncation.

## Quality gate

`src/core/cleanup/quality-gate.ts` is the source of truth. `assessQuality(source, output, { minRatio, checkUrls })` rejects stage output when:

- output is empty (reason `empty`),
- output is not smaller than the source (reason `ineffective`),
- output/source compacted-char ratio is below the stage minimum (reason `too_small_ratio`),
- `checkUrls=true` and output introduces HTTP(S) URLs absent from the source (reason `unexpected_urls`).

Clean defaults to URL checking on; summarize defaults to URL checking off because summaries may intentionally omit or reshape link-heavy detail.

## Configuration ownership

Core config lives in `src/config/config.ts`. Provider-specific config lives next to the provider, such as `src/providers/fetch/firecrawl/firecrawl-env.ts`.

When adding a core config key, update these files together:

- [src/config/config.ts](../src/config/config.ts)
- [.env.example](../.env.example)
- [README.md](../README.md)
- [compose.yaml](../compose.yaml)
- [compose.deploy.yaml](../compose.deploy.yaml)

When adding a provider-specific key, update the provider env schema and the same operator-facing docs/config examples.

## Security notes

- Inbound bearer auth is centralized in `src/clients/auth.ts` and uses constant-time comparison.
- `/health` is always unauthenticated.
- URL validation accepts only `http:` and `https:`.
- Provider responses and template inputs are treated as untrusted external content.
- Mustache escaping is disabled for markdown output, so XML footer attributes are escaped in `src/core/cleanup/debug-footer.ts` before rendering.
- Upstream provider error codes are slugified and bounded before they reach logs or footer attributes.
- `CLIENTS` is parsed against an in-process registry. There is no dynamic plugin loading from disk.

Source comments preserve these search tokens around security-sensitive code paths: `untrusted external content`, `security boundary`, `XML attribute escaping`, `constant-time`, and `sanitizeUpstreamCode`.

## Extending the service

Only extend current scope after updating [ROADMAP.md](ROADMAP.md) and the relevant operator docs.

### Add a fetch provider

1. Create `src/providers/fetch/<impl>/` implementing `FetchProvider`.
2. Add a provider-local env parser such as `parseXxxEnv(env)`.
3. Wire selection in `src/composition.ts` and widen the allowed `FETCH_PROVIDER` values.
4. Update env examples, README config, Compose config, and provider tests.

### Add an LLM provider

Use the same provider shape under `src/providers/llm/<impl>/`, implementing `LlmProvider`. Keep the provider contract compatible with basic Chat Completions unless the architecture is intentionally changed.

### Add a stage

If the stage has the same shape as clean and summarize, create another `LlmStage` instance with its own config block and templates. If it has different inputs, multiple calls, or tool use, create a sibling class rather than subclassing `LlmStage`.

Stage env keys follow this convention:

```text
<STAGE>_ENABLED
<STAGE>_MIN_INPUT_CHARS
<STAGE>_MAX_INPUT_CHARS
<STAGE>_OUTPUT_RATIO
<STAGE>_TIMEOUT_SECONDS
<STAGE>_QUALITY_MIN_RATIO
<STAGE>_CHECK_URLS
```

### Add a client

1. Add `src/clients/<name>/route.ts` (or another client entrypoint type if the registry is extended).
2. Add an entry to `CLIENT_REGISTRY`.
3. Reuse `enforceBearerAuth` for HTTP routes.
4. Reuse `LoadContextUseCase`; do not duplicate orchestration.
5. Let operators opt in through `CLIENTS`.
