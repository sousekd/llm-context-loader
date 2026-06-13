# Agent Smoke Testing Guide

Agent-only rule sheet for the smoke scripts under `scripts/`. Kept terse — each script's header comment is the primary reference. This guide exists to keep agents out of the recurring traps, not to document the pipeline.

## Scripts

| Script                 | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `gather-urls.ps1`      | Collect candidate URLs from a SearXNG instance.       |
| `smoke-jina.ps1`       | Exercise the Jina-style `GET /r/<url>` surface.       |
| `smoke-owui.ps1`       | Exercise the Open WebUI `POST /` batch surface.       |
| `inspect-suspects.ps1` | Compare raw source against loader output for one URL. |
| `shared-lib.ps1`       | Shared helpers; dot-sourced, not run directly.        |

Artifacts land in `scripts/out/` (gitignored).

## Picking URLs

- Keep the set small — **5 URLs or fewer** unless the task explicitly asks for broader coverage. Each provider × surface × environment combination reruns the whole set, so it adds up fast.
- Cover a couple of content shapes: at least one ordinary HTML article, and at least one real document (a true PDF, confirmed by content type rather than a `.pdf` in the path).
- Verify selected URLs with a lightweight `GET` and record content type before running the matrix. `HEAD` is not enough: some sites reject it, and docs URLs rot into 404s.
- Skip raw images unless the task asks for a negative/control URL; they usually produce binary-rejection or tiny metadata-only results.

```powershell
# gather-urls.ps1 reads SEARX_BASE from the environment and does NOT load .env.
$env:SEARX_BASE = 'http://<your-searxng-host>:<port>'
./scripts/gather-urls.ps1 -Count 5 -OutFile scripts/out/urls-smoke.txt

# Or pass known URLs inline (no SearXNG needed):
./scripts/smoke-jina.ps1 -Urls @('https://example.com/article', 'https://example.com/file.pdf')
```

## Choosing a Pipeline and Toggle Set

The shipped pipelines are `full` (default) and `smoke`; `DEFAULT_PIPELINE` selects the one
exposed by the HTTP adapters. External-dependent steps are toggled off by default via env vars
— set them to `true` to enable, and provide their required service URLs. The provider
categories behave differently:

- **Native HTTP fetch** — requests the URL directly, no external service. Always enabled in
  `full` (last-resort fallback after Docling and Firecrawl) and in `smoke`.
- **Firecrawl** — external scraper. Toggle with `FIRECRAWL_ENABLED=true` + `FIRECRAWL_BASE_URL`.
- **Docling OCR** — document-to-markdown converter. Toggle with `DOCLING_ENABLED=true` +
  `DOCLING_BASE_URL`. Gated by `runIf: binary_doc`.
- **LLM passes** — clean and/or summarize. Toggle with `LLM_CLEAN_ENABLED=true` /
  `LLM_SUMMARIZE_ENABLED=true` + `LLM_BASE_URL` + `LLM_MODEL`.

## Running Locally (Node)

```powershell
# Step toggles and provider URLs are read once at startup — set them BEFORE starting.
npm run dev

# In a second terminal:
./scripts/smoke-jina.ps1 -UrlFile scripts/out/urls-smoke.txt -Concurrency 2
./scripts/smoke-owui.ps1 -UrlFile scripts/out/urls-smoke.txt -Concurrency 2 -BatchSize 3

# Quick inline smoke test (no script needed):
curl.exe -s --max-time 30 "http://localhost:3010/r/$([System.Uri]::EscapeDataString('https://en.wikipedia.org/wiki/Rust_(programming_language)'))" | Select-String -Pattern '<loader_info' -Context 0,15

# Stop the server before switching providers so the port frees up:
Get-Process -Name node -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -eq '' -and $_.Id -ne $pid } |
  Stop-Process -Force -ErrorAction SilentlyContinue
```

Changing env vars while the server runs has no effect — restart it.

## Running in Docker

```powershell
# Compose reads variables from the .env FILE. Terminal $env: vars are NOT passed in.
# Edit toggles and provider URLs in .env first, then:
docker compose build      # only when source code changed
docker compose up -d
./scripts/smoke-jina.ps1 -UrlFile scripts/out/urls-smoke.txt -HealthTimeoutSec 30 -Concurrency 2
./scripts/smoke-owui.ps1 -UrlFile scripts/out/urls-smoke.txt -HealthTimeoutSec 30 -Concurrency 2 -BatchSize 3
docker compose down
```

Give the container time to pass its healthcheck — `-HealthTimeoutSec 30` covers startup.

Run the full set against each provider, on each surface, in each environment you need to cover.

## Validating Configuration Without Starting

```powershell
npm run dev -- --check
```

`--check` composes the app and validates the active configuration (pipelines, providers,
templates) without starting the HTTP listener. Exits 0 on success, 1 on failure. Useful in CI
or when iterating on YAML changes without needing a running server.

## Reading the Output

Each run prints a per-URL block and then aggregate breakdowns. When the `debug-xml` renderer is active, the per-URL footer is the source of truth:

- `result` — overall outcome: `ok`, `degraded`, or `failed`.
- `error` — present on failures, with a short machine reason (for example a binary-rejection or empty-source reason).
- The footer also carries per-step entries plus length and ratio fields. Treat the step names as whatever the current pipeline defines — do not assume a fixed set.

The summary block tallies `ok` / `fail` and per-step status counts (`ok`, `skipped`, `degraded`, `failed`) across the set. `skipped` is normal: a step opts out when it does not apply to that URL.

The smoke scripts print a compact footer preview. When a task asks for full diagnostic footers, save raw responses or run a follow-up pass that uses `Get-LoaderFooterLine` from `shared-lib.ps1` and writes the full footer text or JSON to `scripts/out/`.

For the OWUI surface the per-URL time column is the **batch** time shared by every URL in the batch, not a per-URL figure. Jina times are per request.

When the script output is not enough, read the server logs: pipeline start/finish lines carry the URL, outcome, and duration, and step warnings carry a `reason`. To dig into a single URL, use `inspect-suspects.ps1`.

A `result="failed"` with `final_length=0` does not imply a pipeline bug by itself. Check the step entries in the footer: was the fetch step `ok`? Did all steps that should run actually run? An empty final body is normal for 404 pages, paywalled content, or JavaScript-rendered SPAs — the deterministic transformers convert them to empty markdown and the pipeline cannot salvage those. Look at each step's `status` and `reason` before deciding something is wrong.

## Common Traps

- [ ] `SEARX_BASE` exported before `gather-urls.ps1`? It falls back to localhost otherwise.
- [ ] Step toggles (`FIRECRAWL_ENABLED`, `DOCLING_ENABLED`, `LLM_CLEAN_ENABLED`, `LLM_SUMMARIZE_ENABLED`) set **before** `npm run dev`? They are read once at startup.
- [ ] `DEFAULT_PIPELINE` set **before** `npm run dev`? It is also read once at startup.
- [ ] For Docker, edited `.env` rather than a terminal `$env:` var? Compose only reads the file.
- [ ] Previous server stopped before switching providers? Otherwise the port stays taken.
- [ ] `-HealthTimeoutSec 30` on Docker runs so the healthcheck can pass first?
- [ ] Low `-Concurrency` (e.g. 2) for providers that call an LLM or remote service? They are slow per URL.
- [ ] OWUI time column read as a batch time, not per URL?
- [ ] URLs verified with `GET` and content type before the matrix? Do not rely on `HEAD` alone.
- [ ] "PDF" URLs confirmed as real PDFs by content type, not just by their path?
- [ ] Full diagnostic footers needed? The smoke scripts show previews; capture raw responses or use `Get-LoaderFooterLine` for complete footers.
- [ ] Writing ad hoc PowerShell summaries? Collect objects into an array, then pipe the array. A one-line `foreach { ... } | Format-*` after a control block can parse as an empty pipe.
- [ ] Checking the footer by hand: use `Select-String -Pattern '<loader_info'` to grab just the footer from a raw `curl` response. Piping through `Out-String -Width 200` avoids truncation artifacts.
- [ ] `result="failed"` with `final_length=0` is normal for 404 pages, paywalled content, and SPAs that render content via JavaScript. Check the per-step entries in the footer before debugging pipeline code.
- [ ] URLs rot. Verify a URL actually loads the expected content (e.g. on a separate tab or with a raw fetch) before reading too much into footers. Prefer stable sources like Wikipedia for baseline pipeline health checks.

## Cleanup

- Restore `.env` to its original toggle settings.
- `docker compose down` if you started a container.
- Stop any leftover dev server with the kill command above.
