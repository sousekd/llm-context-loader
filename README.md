# LLM Context Loader

> URL-in, markdown-out context loader for LLM tooling.

[![ci](https://github.com/sousekd/llm-context-loader/actions/workflows/ci.yml/badge.svg)](https://github.com/sousekd/llm-context-loader/actions/workflows/ci.yml)
[![release](https://github.com/sousekd/llm-context-loader/actions/workflows/release.yml/badge.svg)](https://github.com/sousekd/llm-context-loader/actions/workflows/release.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-22+-brightgreen.svg)](https://nodejs.org/)

LLM Context Loader is a small HTTP service that turns URLs into markdown suitable for language-model context. The default bundle exposes an Open WebUI external web loader endpoint and a limited Jina Reader-style endpoint, fetches pages through Firecrawl, can run OpenAI-compatible Chat Completions passes, and renders either plain markdown or markdown with an XML diagnostic footer.

## Current Shape

- HTTP adapters: Open WebUI `POST /`, Jina-style `GET /r/<url>` and `GET /r?url=<url>`, plus open `GET /health`.
- Source provider: Firecrawl `/v2/scrape` with markdown output.
- LLM provider: lowest-common-denominator OpenAI-compatible `/chat/completions` using `system` and `user` messages.
- Default pipeline: load the page, clean it with an LLM pass, summarize it when it is too long, cap the output size.
- LLM passes are guarded by URL-hallucination detection that rolls back to trusted source content.
- Output renderers: `debug-xml` and `passthrough`, selected per pipeline in YAML.

It fetches and shapes single URLs; crawling, search, model serving, storage, and retrieval stay outside this tool.

## Quick Start

Requires Node 22+ for local runs.

```bash
npm install
cp .env.example .env
# edit .env for FIRECRAWL_BASE_URL, LLM_BASE_URL, LLM_MODEL, and keys if needed
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

The provider values in `.env.example` are placeholders. Set `FIRECRAWL_BASE_URL`, `LLM_BASE_URL`, and `LLM_MODEL` before starting the service; the Compose files fail early if they are missing. If Firecrawl or the LLM server runs on the host machine, remember that `localhost` inside a container means the container itself. Use a LAN address or `host.docker.internal` when appropriate.

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
