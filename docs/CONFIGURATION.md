# Configuration

This guide covers running and tuning the shipped configuration without redesigning the YAML pipeline. For changing pipeline structure, providers, output renderers, steps, or templates, see [CUSTOMIZATION.md](CUSTOMIZATION.md).

Configuration has two layers:

1. Bootstrap environment variables read directly by the Node process before YAML loading.
2. Environment placeholders inside [config/llm-context-loader.yaml](../config/llm-context-loader.yaml).

For normal operation, copy [.env.example](../.env.example) to `.env`, then replace the provider placeholders with endpoints reachable from the process that will run the service. `.env` is ignored by git and is the right place for local LAN addresses and secrets.

The Compose files read `.env` for interpolation. Running `docker compose config` prints the expanded values, so it can show local endpoints even though the tracked Compose files only contain variable references.

## Bootstrap Environment

These variables are parsed by `src/config/env-config.ts`.

| Variable      | Default                          | Purpose                                            |
| ------------- | -------------------------------- | -------------------------------------------------- |
| `CONFIG_FILE` | `config/llm-context-loader.yaml` | YAML configuration file loaded at startup.         |
| `HOST`        | `0.0.0.0`                        | HTTP bind address.                                 |
| `PORT`        | `3010`                           | HTTP listen port.                                  |
| `LOG_LEVEL`   | `info`                           | pino log level.                                    |
| `LOG_PRETTY`  | `auto`                           | `auto`, `true`, or `false` for pino-pretty output. |

Invalid bootstrap values stop startup with a configuration error.

## Compose-Only Variables

These are used by Compose files and ignored by the Node app.

| Variable           | Used by                                       | Purpose                                                  |
| ------------------ | --------------------------------------------- | -------------------------------------------------------- |
| `LLMC_LOCAL_IMAGE` | [compose.yaml](../compose.yaml)               | Local image tag for builds from the checkout.            |
| `LLMC_IMAGE_TAG`   | [compose.deploy.yaml](../compose.deploy.yaml) | Required GHCR image tag for published-image deployments. |

## Script-Only Variables

These are consumed by helper scripts and ignored by the Node app.

| Variable      | Used by                                        | Purpose                                      |
| ------------- | ---------------------------------------------- | -------------------------------------------- |
| `LOADER_BASE` | `scripts/smoke-*.ps1`, `scripts/inspect-*.ps1` | Base URL of a running LLM Context Loader.    |
| `SEARX_BASE`  | `scripts/gather-urls.ps1`                      | Base URL of a SearXNG instance for URL seed. |

## Default YAML Placeholders

The default YAML file uses environment substitution for provider URLs, tokens, concurrency, timeouts, and renderer selection. Most of these values are shown in [.env.example](../.env.example) and passed through the Compose files.

Validation is lazy: the service validates and constructs only the providers and pipelines that
are reachable from the active configuration. An unused provider with missing env vars will not
fail startup.

The placeholders below are grouped by the part of the pipeline they configure.

### Source provider selection

| Variable          | Default / behavior         | Purpose                                              |
| ----------------- | -------------------------- | ---------------------------------------------------- |
| `SOURCE_PROVIDER` | selected pipeline fallback | Optional source-provider override for `load-source`. |

Leave `SOURCE_PROVIDER` empty to use the selected pipeline's fallback: `http-default` for `truncate`, `firecrawl-html` for `clean-deterministic` and `clean-combined`, and `firecrawl-markdown` for `clean-llm`. Set it only when intentionally overriding that choice.

### Source provider (Firecrawl)

| Variable             | Default / behavior | Purpose                                                                                                            |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `FIRECRAWL_BASE_URL` | empty              | Firecrawl base URL. Required when any Firecrawl-based provider is active (`firecrawl-markdown`, `firecrawl-html`). |
| `FIRECRAWL_API_KEY`  | empty              | Optional Firecrawl bearer token.                                                                                   |

### Source provider (Docling)

| Variable           | Default / behavior | Purpose                                                                                    |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| `DOCLING_BASE_URL` | empty              | Docling Serve base URL. Required only when a pipeline referencing `docling-ocr` is active. |
| `DOCLING_API_KEY`  | empty              | Optional Docling API key.                                                                  |

### Content transformer (mdream)

| Variable       | Default / behavior | Purpose                                                                                                              |
| -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `MDREAM_CLEAN` | `true`             | Post-conversion link and whitespace cleanup for `mdream-convert`. Ignored when `minimal=true` (`mdream-aggressive`). |

### Content transformer (readability)

| Variable                        | Default / behavior | Purpose                                                                          |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `READABILITY_MIN_CONTENT_CHARS` | `140`              | Minimum content length for `isProbablyReaderable` gate in `readability-default`. |
| `READABILITY_MIN_SCORE`         | `20`               | Minimum readerable score for `isProbablyReaderable` gate.                        |
| `READABILITY_MAX_ELEMENTS`      | `0`                | Maximum DOM elements Readability parses; `0` = unlimited (DoS guardrail).        |

### LLM provider (OpenAI-compatible)

| Variable                   | Default / behavior | Purpose                                                                                                                     |
| -------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `LLM_BASE_URL`             | empty              | OpenAI-compatible API base URL, usually ending in `/v1`. Required only when a pipeline referencing `llm-default` is active. |
| `LLM_API_KEY`              | empty              | Optional LLM bearer token.                                                                                                  |
| `LLM_MODEL`                | empty              | Model identifier sent to chat completions. Required only when a pipeline referencing `llm-default` is active.               |
| `LLM_CONTEXT_TOKENS`       | empty in YAML      | Optional model context window in tokens. Empty disables the context-fit gate.                                               |
| `LLM_CHARS_PER_TOKEN`      | `3.5`              | Conservative chars-per-token estimator used for the context-fit gate.                                                       |
| `LLM_SAFETY_MARGIN_TOKENS` | `128`              | Extra tokens reserved for chat-template framing and estimator drift.                                                        |

### Pipeline output and step thresholds

| Variable                      | Default / behavior | Purpose                                                     |
| ----------------------------- | ------------------ | ----------------------------------------------------------- |
| `OUTPUT_TARGET_CHARS`         | `25000`            | Desired maximum characters returned by the active pipeline. |
| `LOAD_SOURCE_TIMEOUT_SECONDS` | `20`               | Per-call timeout for the source-loading step.               |
| `CLEAN_MIN_INPUT_CHARS`       | `1000`             | Minimum body characters before the clean LLM pass runs.     |
| `CLEAN_TIMEOUT_SECONDS`       | `60`               | Per-call timeout for the clean LLM pass.                    |
| `SUMMARIZE_TIMEOUT_SECONDS`   | `60`               | Per-call timeout for the summarize LLM pass.                |

### Concurrency

| Variable              | Default / behavior | Purpose                                           |
| --------------------- | ------------------ | ------------------------------------------------- |
| `SOURCE_CONCURRENCY`  | `1`                | Maximum concurrent source-loading groups.         |
| `PROCESS_CONCURRENCY` | `5`                | Maximum concurrent processing (transform) groups. |
| `LLM_CONCURRENCY`     | `1`                | Maximum concurrent LLM workflow groups.           |

### Output rendering

| Variable                    | Default / behavior | Purpose                                                                     |
| --------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `DEFAULT_OUTPUT_RENDERER`   | `debug-xml`        | Output renderer name for the active pipeline when set to a non-empty value. |
| `DEBUG_XML_INCLUDE_SKIPPED` | `false`            | Include skipped steps in the debug-xml footer (`true`/`false`).             |

### Inbound authentication

| Variable          | Default / behavior | Purpose                                                 |
| ----------------- | ------------------ | ------------------------------------------------------- |
| `OWUI_AUTH_TOKEN` | empty              | Optional bearer token for the Open WebUI adapter route. |
| `JINA_AUTH_TOKEN` | empty              | Optional bearer token for the Jina-style adapter route. |

`.env.example` shows practical local overrides for concurrency, output size, clean-pass thresholds, and `LLM_CONTEXT_TOKENS`. Leave an env value blank or unset it when you want the YAML fallback or schema default instead.

## Environment Substitution Syntax

YAML substitution happens before schema validation.

| Syntax             | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| `${VAR}`           | Resolves to the value of `VAR`, or `""` if unset.               |
| `${VAR:-fallback}` | Uses `VAR` when set to a non-empty value, otherwise `fallback`. |
| `$${VAR}`          | Literal escape. Produces `${VAR}` in the parsed config.         |

Substitution applies recursively to YAML string values. Non-string YAML values are left as YAML values and then parsed by schemas.

Substitution itself is string-only. Numeric and boolean fields recover their types during schema parsing, and blank env values use the field's schema default when that field has one. Blank strings remain meaningful for token fields such as `FIRECRAWL_API_KEY`, `DOCLING_API_KEY`, `LLM_API_KEY`, `OWUI_AUTH_TOKEN`, and `JINA_AUTH_TOKEN`, where empty means no token.

Docker Compose performs its own interpolation before the container starts. The shipped Compose files pass all provider variables through with empty defaults (`${VAR:-}`) so the container always starts and the Node process validates only the active pipeline's providers at startup.

## Authentication

Inbound authentication is configured per HTTP adapter in YAML. The default YAML wires adapter bearer tokens to `OWUI_AUTH_TOKEN` and `JINA_AUTH_TOKEN`.

- Empty token means the adapter route is open.
- Non-empty token requires `Authorization: Bearer <token>`.
- `GET /health` is always open.

Outbound authentication is configured per provider:

- `FIRECRAWL_API_KEY` is sent as bearer auth to Firecrawl when set.
- `DOCLING_API_KEY` is sent via the `X-Api-Key` header to Docling Serve when set.
- `LLM_API_KEY` is sent as bearer auth to the OpenAI-compatible endpoint when set.

## Local And Container Networking

When running directly with Node, `localhost` means your machine.

When running in Docker, `localhost` inside the container means the container itself. For host services, use a LAN address or `host.docker.internal` if your Docker environment supports it. For services in the same Compose project, use the Compose service name.

## Common Startup Failures

- Provider config validation: a reachable provider (referenced by an active pipeline) has an empty required field, e.g. `"firecrawl baseUrl is required"`. The error names the config field, not the env var.
- Invalid YAML shape: the top-level YAML structure failed the coarse schema in `src/config/yaml/yaml-config.ts`.
- Unknown type: a YAML `type` does not exist in the selected built-in descriptor bundles.
- Unknown reference: a pipeline, output renderer, provider, or concurrency group name references an instance that was not declared.
- Missing template file: an `llm-pass` step points at a template path that cannot be read relative to the YAML file directory.
