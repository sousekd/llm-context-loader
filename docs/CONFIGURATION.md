# Configuration

This is the operator guide for running the shipped LLM Context Loader service. It covers environment variables, the default YAML, optional external services, Docker networking, authentication, and startup troubleshooting.

For changing pipeline structure, adding providers, or editing step wiring, use [CUSTOMIZATION.md](CUSTOMIZATION.md).

## Configuration Layers

There are two layers:

1. Bootstrap environment variables parsed before YAML loading.
2. Environment placeholders inside [config/llm-context-loader.yaml](../config/llm-context-loader.yaml).

For normal operation, copy [.env.example](../.env.example) to `.env` and edit values there. The `.env` file is ignored by git and is the right place for local endpoints, model names, concurrency, and tokens.

```bash
cp .env.example .env
npm run dev
```

PowerShell:

```powershell
Copy-Item .env.example .env
npm run dev
```

## Bootstrap Variables

These are read directly by the Node process:

| Variable      | Default                          | Purpose                                            |
| ------------- | -------------------------------- | -------------------------------------------------- |
| `CONFIG_FILE` | `config/llm-context-loader.yaml` | YAML file loaded at startup.                       |
| `HOST`        | `0.0.0.0`                        | HTTP bind address.                                 |
| `PORT`        | `3010`                           | HTTP listen port.                                  |
| `LOG_LEVEL`   | `info`                           | pino log level.                                    |
| `LOG_PRETTY`  | `auto`                           | `auto`, `true`, or `false` for pino-pretty output. |

Invalid bootstrap values stop startup with a configuration error.

## Choosing The Active Pipeline

The default YAML ships two pipelines:

| Pipeline | Purpose                                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`   | Main pipeline. Supports optional Docling, Firecrawl, Readability, LLM clean/summarize passes, URL verification, truncation, and renderer selection. |
| `smoke`  | Testing/debugging pipeline with native HTTP fetch, aggressive mdream conversion, and truncation.                                                    |

Select the active pipeline with:

```dotenv
DEFAULT_PIPELINE=full
```

Both shipped HTTP adapters use `DEFAULT_PIPELINE`, so changing it switches both Open WebUI and Jina-style routes together.

## Optional External Services

The shipped `full` pipeline can run with external services disabled. Enable only the pieces you want.

### Firecrawl

Firecrawl is an optional source provider for page loading.

```dotenv
FIRECRAWL_ENABLED=true
FIRECRAWL_BASE_URL=http://firecrawl.example:3002
FIRECRAWL_API_KEY=
FIRECRAWL_OPTIONS=
```

`FIRECRAWL_OPTIONS` accepts a JSON object string passed through to Firecrawl scrape options.

### Docling

Docling is an optional source provider for binary documents. In the shipped pipeline it runs only for URLs classified as binary document URLs.

```dotenv
DOCLING_ENABLED=true
DOCLING_BASE_URL=http://docling.example:5001
DOCLING_API_KEY=
DOCLING_OPTIONS=
```

`DOCLING_OPTIONS` accepts a JSON object string passed through to Docling convert options.

### OpenAI-Compatible LLM

The LLM provider is optional. It is used by the clean and summarize passes when those steps are enabled.

```dotenv
LLM_CLEAN_ENABLED=true
LLM_SUMMARIZE_ENABLED=false
LLM_BASE_URL=http://llm.example:8080/v1
LLM_API_KEY=
LLM_MODEL=llm-task-text
LLM_CONTEXT_TOKENS=131072
```

`LLM_CONTEXT_TOKENS` enables the character-based context-fit gate. Leave it blank to disable that gate.

## Local Processing Knobs

These knobs do not require external services:

| Variable                        | Default     | Purpose                                                    |
| ------------------------------- | ----------- | ---------------------------------------------------------- |
| `READABILITY_ENABLED`           | `true`      | Enable article extraction before markdown conversion.      |
| `READABILITY_MIN_CONTENT_CHARS` | `140`       | Minimum content length for Readability's suitability gate. |
| `READABILITY_MIN_SCORE`         | `20`        | Minimum readerable score.                                  |
| `READABILITY_MAX_ELEMENTS`      | `0`         | DOM element parse cap; `0` means unlimited.                |
| `MDREAM_CLEAN`                  | `true`      | Post-conversion link and whitespace cleanup.               |
| `OUTPUT_TARGET_CHARS`           | `25000`     | Target maximum output length for summarize/truncate.       |
| `DEFAULT_OUTPUT_RENDERER`       | `debug-xml` | Renderer used by shipped pipelines.                        |
| `DEBUG_XML_INCLUDE_SKIPPED`     | `false`     | Include skipped steps in the XML diagnostic footer.        |

Renderer options:

- `debug-xml` returns markdown plus an XML diagnostic footer.
- `passthrough` returns the final markdown body without the footer.

## Timeouts And Concurrency

The shipped config exposes three concurrency groups:

| Variable              | Default | Purpose                                    |
| --------------------- | ------- | ------------------------------------------ |
| `SOURCE_CONCURRENCY`  | `1`     | Maximum concurrent source-loading groups.  |
| `PROCESS_CONCURRENCY` | `5`     | Maximum concurrent local transform groups. |
| `LLM_CONCURRENCY`     | `1`     | Maximum concurrent LLM workflow groups.    |

Important timeout variables:

| Variable                        | Default | Purpose                          |
| ------------------------------- | ------- | -------------------------------- |
| `FETCH_TIMEOUT_SECONDS`         | `20`    | Native HTTP source load timeout. |
| `FIRECRAWL_TIMEOUT_SECONDS`     | `20`    | Firecrawl source load timeout.   |
| `DOCLING_TIMEOUT_SECONDS`       | `60`    | Docling source load timeout.     |
| `LLM_CLEAN_TIMEOUT_SECONDS`     | `60`    | Clean-pass timeout.              |
| `LLM_SUMMARIZE_TIMEOUT_SECONDS` | `60`    | Summarize-pass timeout.          |

Adjacent steps in the same concurrency group share one limiter slot. In the shipped `full` pipeline, the LLM pass and its URL verification step share the `llm` group.

## Authentication

Inbound bearer tokens are configured per HTTP adapter:

| Variable          | Route    | Behavior                                                                         |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| `OWUI_AUTH_TOKEN` | `POST /` | Empty leaves the route open; non-empty requires `Authorization: Bearer <token>`. |
| `JINA_AUTH_TOKEN` | `GET /r` | Empty leaves the route open; non-empty requires `Authorization: Bearer <token>`. |

`GET /health` is always open.

Outbound tokens:

- `FIRECRAWL_API_KEY` is sent as bearer auth to Firecrawl when set.
- `DOCLING_API_KEY` is sent as `X-Api-Key` to Docling Serve when set.
- `LLM_API_KEY` is sent as bearer auth to the OpenAI-compatible endpoint when set.

## Docker Networking

When running directly with Node, `localhost` means your machine.

When running in Docker, `localhost` inside the container means the container itself. For host services, use a LAN address or `host.docker.internal` if your Docker environment supports it. For services in the same Compose project, use the Compose service name.

The Compose files read `.env` for interpolation. Running `docker compose config` prints expanded values, so avoid doing that in contexts where local endpoints or tokens should stay private.

Compose-only variables:

| Variable           | Used by                                       | Purpose                                         |
| ------------------ | --------------------------------------------- | ----------------------------------------------- |
| `LLMC_LOCAL_IMAGE` | [compose.yaml](../compose.yaml)               | Local image tag for builds from the checkout.   |
| `LLMC_IMAGE_TAG`   | [compose.deploy.yaml](../compose.deploy.yaml) | GHCR image tag for published-image deployments. |

## Environment Substitution

YAML substitution happens before schema validation:

| Syntax             | Meaning                                     |
| ------------------ | ------------------------------------------- |
| `${VAR}`           | Value of `VAR`, or `""` if unset.           |
| `${VAR:-fallback}` | `VAR` when non-empty, otherwise `fallback`. |
| `$${VAR}`          | Literal `${VAR}` in the parsed config.      |

Numeric and boolean strings are parsed later by built-in schemas. Blank values use schema defaults when the field supports that. Token fields keep blank strings meaningful: blank usually means no token.

Opaque fields such as `FIRECRAWL_OPTIONS`, `DOCLING_OPTIONS`, and LLM `extraBody` accept JSON object strings. See [CUSTOMIZATION.md](CUSTOMIZATION.md#opaque-passthrough-fields) for authoring details.

## Startup Troubleshooting

Common failures:

- Provider config validation: an active pipeline references a provider with a missing required field, such as an empty Firecrawl `baseUrl`.
- Unknown type: YAML names a `type` that is not present in the selected descriptor bundle.
- Unknown reference: a pipeline, provider, renderer, transformer, or concurrency group references a name that was not declared.
- Invalid YAML shape: the top-level YAML did not match the expected schema.
- Missing template file: an `llm-pass` step points to a template path that cannot be loaded relative to the YAML file directory.

Validation is lazy for optional pieces. An unused provider with missing environment variables does not fail startup; a reachable provider in an active pipeline does.

## Script-Only Variables

Helper scripts use their own variables and the Node app ignores them:

| Variable      | Used by                                        | Purpose                                       |
| ------------- | ---------------------------------------------- | --------------------------------------------- |
| `LOADER_BASE` | `scripts/smoke-*.ps1`, `scripts/inspect-*.ps1` | Base URL of a running LLM Context Loader.     |
| `SEARX_BASE`  | `scripts/gather-urls.ps1`                      | Base URL of a SearXNG instance for URL seeds. |
