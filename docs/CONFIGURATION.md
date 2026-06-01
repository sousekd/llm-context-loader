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

The default pipeline cannot run without a Firecrawl base URL, an OpenAI-compatible LLM base URL, and a model name. Compose enforces those three values up front with required-variable interpolation. Direct Node startup enforces them during YAML substitution and provider config parsing.

The placeholders below are grouped by the part of the pipeline they configure.

### Source provider (Firecrawl)

| Variable             | Default / behavior | Purpose                          |
| -------------------- | ------------------ | -------------------------------- |
| `FIRECRAWL_BASE_URL` | Required           | Firecrawl base URL.              |
| `FIRECRAWL_API_KEY`  | empty              | Optional Firecrawl bearer token. |

### LLM provider (OpenAI-compatible)

| Variable                   | Default / behavior | Purpose                                                                       |
| -------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `LLM_BASE_URL`             | Required           | OpenAI-compatible API base URL, usually ending in `/v1`.                      |
| `LLM_API_KEY`              | empty              | Optional LLM bearer token.                                                    |
| `LLM_MODEL`                | Required           | Model identifier sent to chat completions.                                    |
| `LLM_CONTEXT_TOKENS`       | empty in YAML      | Optional model context window in tokens. Empty disables the context-fit gate. |
| `LLM_CHARS_PER_TOKEN`      | `3.5`              | Conservative chars-per-token estimator used for the context-fit gate.         |
| `LLM_SAFETY_MARGIN_TOKENS` | `128`              | Extra tokens reserved for chat-template framing and estimator drift.          |

### Pipeline output and step thresholds

| Variable                      | Default / behavior | Purpose                                                      |
| ----------------------------- | ------------------ | ------------------------------------------------------------ |
| `OUTPUT_TARGET_CHARS`         | `25000`            | Desired maximum characters returned by the default pipeline. |
| `LOAD_SOURCE_TIMEOUT_SECONDS` | `20`               | Per-call timeout for the source-loading step.                |
| `CLEAN_MIN_INPUT_CHARS`       | `1000`             | Minimum body characters before the clean LLM pass runs.      |
| `CLEAN_TIMEOUT_SECONDS`       | `60`               | Per-call timeout for the clean LLM pass.                     |
| `SUMMARIZE_TIMEOUT_SECONDS`   | `60`               | Per-call timeout for the summarize LLM pass.                 |

### Concurrency

| Variable             | Default / behavior | Purpose                                                         |
| -------------------- | ------------------ | --------------------------------------------------------------- |
| `SOURCE_CONCURRENCY` | `1`                | Maximum concurrent source-loading groups.                       |
| `LLM_CONCURRENCY`    | `1`                | Maximum concurrent LLM workflow groups in the default pipeline. |

### Output rendering

| Variable                    | Default / behavior | Purpose                                                                      |
| --------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `DEFAULT_OUTPUT_RENDERER`   | `debug-xml`        | Output renderer name for the default pipeline when set to a non-empty value. |
| `DEBUG_XML_INCLUDE_SKIPPED` | `false`            | Include skipped steps in the debug-xml footer (`true`/`false`).              |

### Inbound authentication

| Variable          | Default / behavior | Purpose                                                 |
| ----------------- | ------------------ | ------------------------------------------------------- |
| `OWUI_AUTH_TOKEN` | empty              | Optional bearer token for the Open WebUI adapter route. |
| `JINA_AUTH_TOKEN` | empty              | Optional bearer token for the Jina-style adapter route. |

`.env.example` intentionally sets `LLM_CONTEXT_TOKENS` to a large example value so the context-fit gate is enabled in copied local configs. Leave it blank when you want to disable that gate.

## Environment Substitution Syntax

YAML substitution happens before schema validation.

| Syntax             | Meaning                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `${VAR}`           | Required. Startup fails if `VAR` is not set.                              |
| `${VAR:-fallback}` | Optional. Uses `VAR` when set to a non-empty value, otherwise `fallback`. |
| `$${VAR}`          | Literal escape. Produces `${VAR}` in the parsed config.                   |

Substitution applies recursively to YAML string values. Non-string YAML values are left as YAML values and then parsed by schemas.

Substitution itself is string-only. Numeric and boolean fields recover their types during schema parsing, and blank env values use the field's schema default when that field has one. Blank strings remain meaningful for token fields such as `FIRECRAWL_API_KEY`, `LLM_API_KEY`, `OWUI_AUTH_TOKEN`, and `JINA_AUTH_TOKEN`, where empty means no token.

Docker Compose performs its own interpolation before the container starts. The shipped Compose files use `${VAR:?message}` for values that must be supplied by `.env` or the shell, so missing or blank provider values fail before the container is created.

## Authentication

Inbound authentication is configured per HTTP adapter in YAML. The default YAML wires adapter bearer tokens to `OWUI_AUTH_TOKEN` and `JINA_AUTH_TOKEN`.

- Empty token means the adapter route is open.
- Non-empty token requires `Authorization: Bearer <token>`.
- `GET /health` is always open.

Outbound authentication is configured per provider:

- `FIRECRAWL_API_KEY` is sent as bearer auth to Firecrawl when set.
- `LLM_API_KEY` is sent as bearer auth to the OpenAI-compatible endpoint when set.

## Local And Container Networking

When running directly with Node, `localhost` means your machine.

When running in Docker, `localhost` inside the container means the container itself. For host services, use a LAN address or `host.docker.internal` if your Docker environment supports it. For services in the same Compose project, use the Compose service name.

## Common Startup Failures

- Missing required environment variable: a YAML placeholder such as `${FIRECRAWL_BASE_URL}` or `${LLM_MODEL}` was not provided and has no fallback in the running environment.
- Missing required Compose variable: a Compose placeholder such as `${FIRECRAWL_BASE_URL:?Set FIRECRAWL_BASE_URL in .env or the shell}` was unset or blank.
- Invalid YAML shape: the top-level YAML structure failed the coarse schema in `src/config/yaml/yaml-config.ts`.
- Unknown type: a YAML `type` does not exist in the selected built-in descriptor bundles.
- Unknown reference: a pipeline, output renderer, provider, or concurrency group name references an instance that was not declared.
- Missing template file: an `llm-pass` step points at a template path that cannot be read relative to the YAML file directory.
