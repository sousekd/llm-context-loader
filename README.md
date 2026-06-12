# LLM Context Loader

> URL-in, markdown-out context loader for LLM tooling.

[![ci](https://github.com/sousekd/llm-context-loader/actions/workflows/ci.yml/badge.svg)](https://github.com/sousekd/llm-context-loader/actions/workflows/ci.yml)
[![release](https://github.com/sousekd/llm-context-loader/actions/workflows/release.yml/badge.svg)](https://github.com/sousekd/llm-context-loader/actions/workflows/release.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-22+-brightgreen.svg)](https://nodejs.org/)

LLM Context Loader is a small HTTP service that turns URLs into markdown for LLM context. It exposes Open WebUI and Jina Reader-style HTTP endpoints, fetches pages through built-in or external providers, can run LLM passes, and renders markdown with an optional XML diagnostic footer. It handles single URLs — crawling, search, model serving, storage, and retrieval stay outside this tool.

## Current Shape

- **Pipelines:** `truncate` (default, no LLM), `clean-deterministic` (Firecrawl HTML + Readability + mdream, no LLM), `clean-llm` (Firecrawl + LLM), and `clean-combined` (Firecrawl HTML + Readability + mdream + LLM summarize), selected via `DEFAULT_PIPELINE`.
- **Source providers:** native HTTP fetch, Firecrawl, Docling.
- **Content transformers:** `readability` (article HTML extraction), `mdream` (HTML to markdown).
- **LLM providers:** OpenAI-compatible `/chat/completions`.
- **Output renderers:** `debug-xml` and `passthrough`, selected per pipeline in YAML.

## Quick Start

Requires Node 22+ for local runs.

```bash
npm install
cp .env.example .env
npm run dev
```

PowerShell equivalent:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Check the server:

```bash
curl http://localhost:3010/health
curl http://localhost:3010/r/https://example.com
```

Both `npm run dev` and `npm start` load `.env` through Node's `--env-file-if-exists` flag.

## Docker

Local image from the current checkout:

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:3010/health
```

Published image from GitHub Container Registry:

```bash
cp .env.example .env
docker compose -f compose.deploy.yaml pull
docker compose -f compose.deploy.yaml up -d
```

The deploy compose file requires `LLMC_IMAGE_TAG`. The example env file uses `latest`, but repeatable deployments should pin it to an immutable release tag.

The out-of-box `truncate` pipeline needs no provider config. Switch to `clean-llm` with `DEFAULT_PIPELINE=clean-llm` and the appropriate provider vars. The Compose files pass all variables through without failing early; the service validates only the active pipeline's providers at startup. If Firecrawl or the LLM server runs on the host, use a LAN address or `host.docker.internal` instead of `localhost`.

## API

| Method | Path       | Purpose                                                              |
| ------ | ---------- | -------------------------------------------------------------------- |
| `POST` | `/`        | Open WebUI external web loader. Body: `{ "urls": ["https://..."] }`. |
| `GET`  | `/r/<url>` | Jina Reader-style URL-to-markdown route.                             |
| `GET`  | `/r?url=`  | Query-string form of the Jina-style route.                           |
| `GET`  | `/health`  | Liveness probe. Always open.                                         |

Open WebUI example:

```yaml
environment:
  WEB_LOADER_ENGINE: "external"
  EXTERNAL_WEB_LOADER_URL: "http://llm-context-loader:3010/"
  EXTERNAL_WEB_LOADER_API_KEY: ""
```

When `OWUI_AUTH_TOKEN` is configured, set `EXTERNAL_WEB_LOADER_API_KEY` to the same value.

## Configuration

There are two layers of configuration:

- Bootstrap environment variables choose the config file, bind address, port, and logging.
- YAML config declares HTTP adapters, providers, renderers, pipelines, steps, templates, timeouts, and concurrency groups.

For normal operation with the shipped YAML, start with [.env.example](.env.example) and [docs/CONFIGURATION.md](docs/CONFIGURATION.md). For changing pipeline structure or built-in knobs, read [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).

## Developer Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes the internal architecture and dependency boundaries.
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) covers running and tuning the shipped configuration.
- [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) documents the YAML configuration surface.
- [docs/ROADMAP.md](docs/ROADMAP.md) records scope boundaries and direction.
- [docs/TESTING.md](docs/TESTING.md) describes the test layout, commands, and helpers.
- [docs/RELEASING.md](docs/RELEASING.md) records the release and deployment workflow.

## Development Commands

```bash
npm run typecheck       # source typecheck
npm run typecheck:all   # source + tests typecheck
npm run build           # tsc -> dist/
npm test                # vitest run --coverage
```

Tests live under `tests/` and mirror `src/`. They use dependency injection and plain stubs.

## License

[MIT](LICENSE).
