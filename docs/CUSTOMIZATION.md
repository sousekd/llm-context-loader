# Customization

This guide documents the YAML configuration surface: the adapters, providers, output renderers, pipelines, and steps you can declare and tune without writing code. For running and tuning the shipped configuration through environment variables, see [CONFIGURATION.md](CONFIGURATION.md).

The default config is [config/llm-context-loader.yaml](../config/llm-context-loader.yaml). Paths used by step templates are resolved relative to the YAML file directory. Custom YAML files can use the same environment placeholder syntax described in [CONFIGURATION.md](CONFIGURATION.md); keep provider URLs, model names, tokens, and deployment-specific numbers in environment variables when they differ by machine or environment.

The built-in types below are the ones the default bundle ships. The codebase is organized to be forking-friendly: each built-in lives in its own folder behind a small descriptor contract, so adding a custom provider, step, renderer, or adapter is a localized change.

## YAML Shape

The top-level YAML sections are maps keyed by instance name:

```yaml
schemaVersion: 1
httpAdapters: {}
outputRenderers: {}
sourceProviders: {}
contentTransformers: {}
llmProviders: {}
pipelines: {}
```

`schemaVersion` is required at the top of the file and must be `1`. It exists so future incompatible YAML shape changes can be detected and rejected with a clear error.

Configured implementation instances generally look like this:

```yaml
some-name:
  type: built-in-type
  config: {}
```

HTTP adapters also name the pipeline they expose:

```yaml
some-adapter:
  type: open-webui
  pipeline: ${DEFAULT_PIPELINE:-truncate}
  config: {}
```

Each pipeline has an optional `enabled` field (tri-state: `true`, `false`, or omitted). When
omitted, a pipeline is active only when at least one HTTP adapter references it. Setting
`enabled: false` parks it. Setting `enabled: true` pins it active regardless of adapter
references. The shipped pipelines leave `enabled` omitted, so `DEFAULT_PIPELINE` alone drives
the active set. Active-set pipelines are compiled and validated at startup; inactive ones are
skipped (their providers are never built).

Pipeline steps include common orchestration fields plus a type-specific `config` block:

```yaml
- type: llm-pass
  name: clean
  concurrencyGroup: llm
  timeoutSeconds: 90
  config: {}
```

Step names must be unique within a pipeline and must be valid diagnostic names: lowercase letters, numbers, and underscores, starting with a lowercase letter.

## HTTP Adapters

HTTP adapters register inbound routes and bind them to one pipeline.

### `open-webui`

Default route: `POST /`.

```yaml
config:
  path: /
  maxUrls: 20
  auth:
    bearerToken: ${OWUI_AUTH_TOKEN:-}
```

The request body must be `{ "urls": ["https://..."] }`. The response is a list of Open WebUI document rows shaped as `{ "page_content": "...", "metadata": { "source": "..." } }`; a successful pipeline may also include `metadata.title`. Each URL is handled independently. Invalid URLs or pipeline-rendered failures stay in the batch as diagnostic document rows instead of failing the whole request.

### `jina`

Default route: `GET /r` and `GET /r/*`.

```yaml
config:
  path: /r
  auth:
    bearerToken: ${JINA_AUTH_TOKEN:-}
```

The adapter accepts both `GET /r/<url>` and `GET /r?url=<url>` and returns `text/markdown`.

## Output Renderers

Output renderers turn a completed pipeline run into markdown.

### `debug-xml`

```yaml
config:
  rootElement: loader_info
  includeSkipped: false
```

Appends an XML diagnostic footer to the body. If the pipeline produced no body, or the final body is binary, the footer is returned by itself. Body lengths in the footer are characters for text and bytes for binary. `includeSkipped` defaults to `false`; set it to `true` to list skipped steps in the footer.

### `passthrough`

```yaml
config: {}
```

Returns the current text body without a diagnostic footer. If the pipeline failed before producing a text body, returns the pipeline error message.

## Source Providers

### `http`

```yaml
config:
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
  maxBytes: 5000000
  titleFromHtml: true
```

| Knob            | Values | Default             | Purpose                                                                                                                                                                                                                                                |
| --------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `userAgent`     | string | Chrome 124 Linux UA | User-Agent header sent with the fetch request.                                                                                                                                                                                                         |
| `maxBytes`      | int    | `5000000`           | Response body size cap. The body is read as a stream and the connection is cancelled once the cap is reached, so memory stays bounded. When the cap truncates the body, the document is flagged truncated and the load-source step reports `degraded`. |
| `titleFromHtml` | bool   | `true`              | When enabled, extracts the first `<title>` tag content from the HTML response.                                                                                                                                                                         |

**Security caveat — testing only.** This provider fetches the input URL directly with no SSRF protection. It is intended as a zero-dependency testing fallback — no `baseUrl`, no `apiKey`, no external service required.

The provider preserves textual response media types from `Content-Type` (`text/*`, JSON, XML, and structured `+json`/`+xml` types). Missing `Content-Type` defaults to `text/plain` when the body passes the text sniff. Binary responses are returned as binary bodies; mislabeled text-like responses containing NUL bytes are reclassified as `application/octet-stream`. If a binary body reaches the end of the pipeline without a converter, the run fails with `unconverted_binary: <mediaType>` instead of returning raw bytes.

### `firecrawl`

```yaml
config:
  baseUrl: ${FIRECRAWL_BASE_URL}
  apiKey: ${FIRECRAWL_API_KEY:-}
  output: markdown
  onlyMainContent: true
  stripBase64Images: true
  parsePdf: true
```

| Knob                | Values                            | Default    | Purpose                                                                                                                                                                                                                                                                           |
| ------------------- | --------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output`            | `markdown` \| `html` \| `rawHtml` | `markdown` | Which format Firecrawl returns. `html` is cleaned main-content HTML. `rawHtml` is "raw" — full JS-rendered DOM for web pages, viewer `<img>` wrapper for images, and bare extracted text for PDFs (use for Readability testing).                                                  |
| `onlyMainContent`   | bool                              | `true`     | When enabled Firecrawl extracts the main page content and strips headers, nav, footers. No-op for `rawHtml`.                                                                                                                                                                      |
| `stripBase64Images` | bool                              | `true`     | Maps to `removeBase64Images` — replaces inline data URIs with short placeholders in markdown output. No-op for `html`/`rawHtml`.                                                                                                                                                  |
| `parsePdf`          | bool                              | `true`     | Configurable via `FIRECRAWL_PARSE_PDF`. When `true`, Firecrawl parses PDF files to extracted text. When `false`, raw PDF bytes are returned as a binary body (`application/pdf`) — the pipeline fails with `unconverted_binary` until a PDF converter (e.g. Docling) is wired up. |

The provider calls `/v2/scrape`. Upstream HTTP, parse, empty, and network failures are converted to degradable upstream errors. Title is read from `data.metadata.title` (format-independent). The media type of returned bodies is derived truthfully:

| `output` | HTML / docx source | image source    | PDF source (parsePdf:true) |
| -------- | ------------------ | --------------- | -------------------------- |
| markdown | `text/markdown`    | `text/markdown` | `text/markdown`            |
| html     | `text/html`        | `text/html`     | `text/html` (wrapped)      |
| rawHtml  | `text/html`        | `text/html`     | **`text/plain`**           |

`rawHtml` is "raw": for web pages and images it returns HTML, but for PDFs it returns bare extracted text. The provider detects this by looking at whether the content starts with an HTML tag — if not, it labels it `text/plain` so downstream transformers (which gate on `isHtmlMediaType`) skip it correctly. When `parsePdf:false`, PDFs are returned as binary (`application/pdf`) from base64-decoded raw bytes supplied by Firecrawl's empty-`parsers` mode.

### `docling`

```yaml
config:
  baseUrl: ${DOCLING_BASE_URL}
  apiKey: ${DOCLING_API_KEY:-}
  output: markdown
  doOcr: true
  tableMode: accurate
```

| Knob        | Values               | Default    | Purpose                                                                                                                                                |
| ----------- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `output`    | `markdown` \| `html` | `markdown` | Which format Docling returns. `html` is the Docling HTML serializer output (polished semantic HTML with inline CSS — does NOT provide raw/rough HTML). |
| `doOcr`     | bool                 | `true`     | Run OCR on scanned documents and images within PDFs.                                                                                                   |
| `tableMode` | `fast` \| `accurate` | `accurate` | Table extraction quality. `accurate` is slower but better for complex layouts.                                                                         |

The provider calls `POST /v1/convert/source`. Title is read from `document.json_content.name` (the JSON format is always requested internally regardless of the `output` setting). Upstream HTTP, parse, empty, and network failures are converted to degradable upstream errors. `output: markdown` returns `text/markdown`; `output: html` returns `text/html`.

## Content Transformers

Content transformers convert a loaded body from one representation to another in-process, with no upstream call. The `transform` pipeline step selects a transformer by name and applies it to the current body.

### `readability`

Extracts main-article HTML from raw HTML using [Mozilla Readability](https://github.com/mozilla/readability). It uses `isProbablyReaderable` as a suitability gate: article-like pages become cleaned HTML; other pages return `declined` and keep the current body unchanged.

```yaml
config:
  minContentLength: ${READABILITY_MIN_CONTENT_CHARS:-140}
  minScore: ${READABILITY_MIN_SCORE:-20}
  maxElements: ${READABILITY_MAX_ELEMENTS:-0}
```

| Knob               | Values       | Default | Purpose                                                                                              |
| ------------------ | ------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `minContentLength` | positive int | `140`   | Minimum content length for `isProbablyReaderable`.                                                   |
| `minScore`         | number >= 0  | `20`    | Minimum readerable score for `isProbablyReaderable`.                                                 |
| `maxElements`      | int >= 0     | `0`     | Maximum DOM elements Readability parses. `0` = unlimited (DoS guardrail). Maps to `maxElemsToParse`. |

Supports text `text/html` or `application/xhtml+xml` bodies targeting `text/html`. The incoming title is preserved; when absent, the extracted article title is used instead.

Decline reasons are `not_readerable`, `parse_empty`, and `output_empty`. Runtime errors propagate to the orchestrator; the failed step has no effect, so downstream steps continue from the prior body and the run rolls up as `degraded`.

### `mdream`

Converts HTML bodies to markdown using the [`@mdream/js`](https://www.npmjs.com/package/@mdream/js) library. Pure-JS, no native dependencies.

Two shipped instances are declared in the config:

**`mdream-convert`** — used after `readability` in shipped pipelines. It converts HTML to markdown without re-extracting main content.

```yaml
config:
  clean: ${MDREAM_CLEAN:-true}
```

**`mdream-aggressive`** — extraction + conversion in one pass using mdream's minimal preset. Suitable for custom pipelines without a prior readability step.

```yaml
config:
  minimal: true
```

| Knob      | Values | Default | Purpose                                                                                                  |
| --------- | ------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `minimal` | bool   | `false` | Apply mdream's minimal preset (isolate main content, filter boilerplate). Takes precedence over `clean`. |
| `clean`   | bool   | `true`  | Clean up the markdown output: drop tracking params, redundant and empty links, and collapse blank lines. |

The transformer supports text bodies whose media type is `text/html` or `application/xhtml+xml` and a requested target of `text/markdown`. The input URL is passed to mdream as the conversion origin, so relative links and images resolve against it. The original body title is preserved.

## LLM Providers

### `openai-chat`

```yaml
config:
  baseUrl: ${LLM_BASE_URL}
  apiKey: ${LLM_API_KEY:-}
  model: ${LLM_MODEL}
  contextTokens: ${LLM_CONTEXT_TOKENS:-}
  charsPerToken: ${LLM_CHARS_PER_TOKEN:-3.5}
  safetyMarginTokens: ${LLM_SAFETY_MARGIN_TOKENS:-128}
  extraBody: {}
```

The provider joins `baseUrl` with `/chat/completions`; for OpenAI-compatible servers this usually means configuring a `/v1` base URL. It sends `model` and `messages`, using only `system` and `user` roles. `extraBody` is spread into the request body after the standard fields, so it can provide sampler or server-specific parameters.

Values inside `extraBody` are opaque YAML values. YAML booleans and numbers stay typed, but env placeholders inside `extraBody` substitute as strings.

One provider instance corresponds to one model. To use several models against the same server, declare additional `openai-chat` instances with different names and `model` values.

Context-fit fields are optional and own the char-to-token conversion:

- `contextTokens` — model context window. Leaving it empty disables the context-fit gate, and the provider always reports prompts as fitting.
- `charsPerToken` — conservative chars-per-token estimator. Lower values reject more aggressively. Default `3.5`. This is a character-based approximation rather than a real tokenizer.
- `safetyMarginTokens` — extra tokens reserved for chat-template framing or estimator drift. Default `0` in the provider schema; the bundled YAML defaults it to `128` via `LLM_SAFETY_MARGIN_TOKENS`. Increase if the model still rejects prompts the gate accepts.

## Pipelines

A pipeline chooses one output renderer, declares limiter groups, and lists steps in order.

```yaml
pipelines:
  default:
    outputRenderer: ${DEFAULT_OUTPUT_RENDERER:-debug-xml}
    limiters:
      source: ${SOURCE_CONCURRENCY:-1}
      llm: ${LLM_CONCURRENCY:-1}
    steps: []
```

`outputRenderer` references a named output renderer instance. `limiters` declares concurrency group names and their maximum concurrency. A step can opt into a group with `concurrencyGroup`.

Adjacent steps that share the same `concurrencyGroup` share one limiter acquisition. In the `clean-llm` pipeline, `llm-pass(clean)`, `verify_after_clean`, `llm-pass(summarize)`, and `verify_after_summarize` all use the `llm` group, so a URL holds one LLM workflow slot across both passes and their URL checks. Inserting a step with a different (or no) group between them splits that acquisition.

`timeoutSeconds` applies to both limiter waiting and step execution. For one adjacent concurrency block, limiter waiting uses the longest `timeoutSeconds` value in that block.

## Steps

### `load-source`

```yaml
config:
  provider: ${SOURCE_PROVIDER:-http-default}
```

Loads the initial body from a named source provider. If a body already exists, the step skips with `body_present`.

### `llm-pass`

```yaml
config:
  provider: llm-default
  minInputChars: 1500
  maxInputChars: 80000
  outputReserveRatio: 1.0
  outputReserveChars: 25000
  templates:
    system: ../templates/clean.system.md
    user: ../templates/clean.user.md
    vars:
      targetChars: 25000
```

Runs a prompt-rendered LLM transformation against the current text body. The step skips when:

- there is no body (`no_body`)
- the current body is binary (`unsupported_media_type`)
- input is shorter than `minInputChars`, when set (`too_short`)
- input is longer than `maxInputChars`, when set (`too_long`)
- the provider reports the rendered prompt plus the reserved output cannot fit the model context window (`context_overflow`)

`minInputChars` and `maxInputChars` are optional. When omitted, those gates are disabled; only `context_overflow` then protects the call.

Output reservation controls how much room the step asks the provider to keep free for the reply during the context-fit check. It does not become a per-call `max_tokens`; the model is free to use the reserved budget. Reservation is computed as `max(outputReserveRatio * inputChars, outputReserveChars)`. When neither field is set, reservation defaults to the input length (output ≈ input).

- `outputReserveRatio` — reserve relative to the body. Use `1.0` for non-compressing passes (clean), lower values for compressing passes.
- `outputReserveChars` — absolute reserve in characters. Useful for summarize where the desired final size is a known target.

Both templates are required. `templates.vars` is an optional map of literal values injected into the Mustache context alongside the body variables; use it to pass operator-tunable hints (such as a desired output size) into prompt files. The available Mustache variables are:

| Variable           | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `url`              | Input URL for this pipeline run.                  |
| `title`            | Current body title, when available.               |
| `content`          | Current text body content.                        |
| `templates.vars.*` | Any keys declared under `templates.vars` in YAML. |

Mustache escaping is disabled for prompt templates so markdown is passed through as-is.

### `transform`

```yaml
config:
  transformer: mdream-convert
  target: text/markdown
  onUnsupported: skip
  emitDiagnostics: false
```

Applies a named content transformer to the current body. The step resolves `transformer` from the `contentTransformers` registry and asks it to produce `target`.

| Knob              | Values           | Default | Purpose                                                                                                        |
| ----------------- | ---------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `transformer`     | string           | —       | Name of a configured `contentTransformers` instance. Required.                                                 |
| `target`          | string           | —       | Media type the transformer must produce, for example `text/markdown`. Required.                                |
| `onUnsupported`   | `skip` \| `fail` | `skip`  | What to do when the transformer does not support the current body (wrong source media type or representation). |
| `onDeclined`      | `skip` \| `fail` | `skip`  | What to do when the transformer returns `declined`.                                                            |
| `emitDiagnostics` | bool             | `false` | When enabled, transformer-reported diagnostics are surfaced as child nodes in the step report.                 |

The step skips with `no_body` when there is no body. When the transformer does not support the current body it skips with `unsupported` (or fails with `onUnsupported: fail`). When the transformer returns `declined`, the step skips with that reason (or fails with `onDeclined: fail`). A transform aborted by the step timeout fails with `timeout`. If the transformer returns a body that does not match `target`, the step fails with `wrong_output_type`.

### `truncate`

```yaml
config:
  targetChars: 25000
```

Truncates the current body when it exceeds `targetChars`. A target of `0` disables truncation by causing the step to skip.

### `capture-urls`

```yaml
config:
  artifact: trusted-urls
```

Reads the current body, extracts and canonicalizes URLs (inline links, autolinks, and bare HTTP(S) URLs; ignores fenced and inline code, images, and reference definitions), and writes the resulting `Set<string>` to an artifact. It also seeds a sibling marker artifact (`<artifact>:checked-content`) with the verbatim source body, so a later `verify-urls` step skips until a step actually changes the body. Skips with `no_body` when there is no body. Place after `load-source` to capture the trusted source-URL inventory before any LLM stage runs.

Diagnostics: `artifact`, `url_count`.

### `verify-urls`

```yaml
config:
  artifact: trusted-urls
  onHallucination: rollback
  maxReportedUrls: 50
```

Compares URLs in the current body against the inventory written by an earlier `capture-urls` step. Place it directly after the step whose output you want to gate (typically each `llm-pass`). The comparison uses the same canonicalization as `capture-urls`.

Modes (`onHallucination`):

- `report` (default): on hallucinations the step returns `degraded` with `reason: hallucinated_urls` and lists the offending URLs in its diagnostics; the body is left unchanged.
- `rollback`: same diagnostics, but the body is also rolled back to the version that was the input to the gated step.

In both modes a hallucination makes the pipeline rollup `degraded` (an earlier body still exists). An `ok` or `report` run advances the `<artifact>:checked-content` marker to the body it just checked, so the step skips with `content_unchanged` whenever the current body equals content already checked. A `rollback` run leaves the marker untouched, since it restores an unverified prior version. The step also skips with `no_body`, `no_inventory`, or `no_prior_version` (rollback only, when there is nothing to roll back to).

`maxReportedUrls` caps the per-URL child list independently of the mode: omit it to report every hallucinated URL, `0` to report none (attributes only), or a positive `N` to report the top `N` worst offenders. The log line always reports the full hallucinated count regardless of the cap.

Shipped defaults: `verify_after_clean` uses `rollback` with `maxReportedUrls: 0` (silent rollback), `verify_after_summarize` uses `report` with `maxReportedUrls: 50`.

## Shipped Pipelines

The config ships four pipelines, selected via `DEFAULT_PIPELINE` (defaults to `truncate`).

### `truncate` (default)

```text
load-source(http-default) -> truncate
```

Fetches the URL directly and truncates to budget. No external services required.

### `clean-deterministic`

```text
load-source(firecrawl-html) -> transform(clean via readability) -> transform(convert via mdream) -> truncate
```

Loads Firecrawl raw HTML, extracts article HTML with `readability` when suitable, converts HTML to markdown with `mdream`, then truncates. No LLM passes. Pipeline fallback: `firecrawl-html`. Select with `DEFAULT_PIPELINE=clean-deterministic`.

### `clean-llm`

```text
load-source(firecrawl-markdown) -> capture-urls -> llm-pass(clean) -> verify-urls(rollback) -> llm-pass(summarize) -> verify-urls(report) -> truncate
```

The original reference pipeline. Loads markdown from a Firecrawl instance, runs clean and summarize LLM passes with URL-hallucination gates, then truncates. Pipeline fallback: `firecrawl-markdown`. Select with `DEFAULT_PIPELINE=clean-llm`.

### `clean-combined`

```text
load-source(firecrawl-html) -> transform(clean via readability) -> transform(convert via mdream) -> capture-urls -> llm-pass(summarize) -> verify-urls(report) -> truncate
```

Combines the deterministic HTML-to-markdown path with an LLM summarize pass. Pipeline fallback: `firecrawl-html`. Select with `DEFAULT_PIPELINE=clean-combined`.
