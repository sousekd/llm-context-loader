# AGENTS.md

This file is for AI coding agents working on this repository.

## Project identity

This project is an **LLM Context Loader**.

Its purpose is to turn URLs into clean, useful context for LLMs. The first client is Open WebUI's external web loader. The first fetch provider is Firecrawl. The first LLM provider is an OpenAI-compatible Chat Completions endpoint.

Do not frame this project as a Firecrawl patch. Firecrawl is only one provider.

First-time orientation for agents: read this file, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then [docs/ROADMAP.md](docs/ROADMAP.md). The user-facing [README.md](README.md) and [docs/RELEASING.md](docs/RELEASING.md) cover operator concerns and are linked from there.

---

# Invariants (timeless)

These rules apply to every change at every version. They only change with an explicit, documented architectural decision.

## Architecture rules

Keep these boundaries intact (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full layout):

- `src/core/` is framework-free domain code. It must not import from `providers/`, `clients/`, `http.ts`, or Fastify.
- `src/core/ports/` defines provider interfaces (`FetchProvider`, `LlmProvider`).
- `src/core/use-cases/` contains the application use case (`LoadContextUseCase`) and the shared `LlmStage` class (`core/use-cases/llm-stage/`). Clean and summarize are **instances** of `LlmStage`, not subclasses. If a future stage diverges structurally, fork rather than inherit — sibling classes beat inheritance trees.
- `src/core/cleanup/` contains the prompt templates renderer, length policy, quality gate, truncate stage, and diagnostic footer.
- `src/providers/<class>/<impl>/` implements a port. One folder per concrete implementation. Currently: `providers/fetch/firecrawl/`, `providers/llm/openai-chat/`. Each provider exports a `parseXxxEnv(env)` schema (e.g. `firecrawl-env.ts`) so its keys live next to the implementation and never pollute the core config.
- `src/clients/<name>/` maps an external client contract (HTTP route + adapter) to a use case. Currently: `clients/openwebui/`, `clients/jina/`. The set of clients to register at startup is driven by the `CLIENTS` env via `src/clients/registry.ts`; new clients add a registry entry with a `kind` discriminator (room for future stdio/CLI/MCP). Shared bearer-token enforcement lives in `clients/auth.ts`.
- `src/composition.ts` is the **only** place that constructs concrete providers and wires them into the use case. It also constructs the per-stage `LlmStage` instances. It calls each provider's env parser separately, so unrelated deployments never need to supply unrelated keys.
- `src/http.ts` builds Fastify, iterates `composition.clients` to register HTTP plugins, sets the error handler, and serves `GET /health` inline (it is a liveness probe, not a client surface, so it does not live under `clients/`).
- `limiters.llm` wraps the entire per-URL LLM workflow inside `LoadContextUseCase` as a single unit (clean + summarize today, future stages later) — not individual chat calls.
- Per-stage env naming convention: `<STAGE>_ENABLED`, `<STAGE>_MIN_INPUT_CHARS`, `<STAGE>_MAX_INPUT_CHARS`, `<STAGE>_OUTPUT_RATIO`, `<STAGE>_TIMEOUT_SECONDS`, `<STAGE>_QUALITY_MIN_RATIO`, `<STAGE>_CHECK_URLS`. Shared LLM knobs (`LLM_CONTEXT_TOKENS`, `LLM_CHARS_PER_TOKEN`, `LLM_CONCURRENCY`) stay un-prefixed.
- Templates: every LLM stage receives the same variable bag `{ url, title, content }`. The footer template (`templates/footer.md`) receives the snake_case bag from `core/cleanup/debug-footer.ts`.
- Tests live under `tests/` mirroring `src/`. Use dependency injection and plain stubs — no mocking library.
- `scripts/` holds PowerShell smoke-test helpers (`gather-urls.ps1`, `smoke-jina.ps1`, `smoke-owui.ps1`, etc.). They are developer-only, excluded from the Docker image, and not part of any port, use case, or test path.
- When adding a core config key, update [src/config/config.ts](src/config/config.ts), `.env.example`, the README config table, [compose.yaml](compose.yaml), and [compose.deploy.yaml](compose.deploy.yaml) in the same change. Provider-specific keys live in the provider's `*-env.ts` schema instead.

Use generic names:

- `FetchProvider`, not `FirecrawlOnlyService`.
- `LlmProvider`, not `VllmService`.
- `LoadContextUseCase`, not `ScrapeUrlFunction`.
- `LlmStage`, not `CleanFunction` / `SummarizeFunction`. Concrete stages are constructor-configured instances.

## Technology choices

Use:

- TypeScript
- Fastify
- Zod
- pino
- p-limit
- Node's built-in `fetch`

Avoid:

- LangChain
- LlamaIndex
- LiteLLM
- Vercel AI SDK
- NestJS
- Express
- Redis/BullMQ
- Python runtime inside this service

The service intentionally makes boring HTTP calls to `/v1/chat/completions` with `system` and `user` roles only.

## Error/fallback philosophy

For Open WebUI, mysterious empty output is worse than a diagnostic document. The cascade keeps the "best available" content as the fallback at every step. Only fetch failure is fatal; every LLM-stage failure degrades silently.

Default behavior (`DIAGNOSTIC_FOOTER_ENABLED=true`):

- Fetch failure → return a diagnostic document with `<context_loader_info returned="error" fetch_status="<reason>" ... />`.
- LLM stage failure (HTTP, parse, missing text) → keep the previous stage's output; record `<stage>_status="llm_failed"` plus a reason.
- LLM stage timeout → keep the previous stage's output; record `<stage>_status="timeout"`.
- Stage output rejected by quality gate → keep the previous stage's output; record `<stage>_status="quality_rejected"` plus a reason.
- Stage skipped → keep the previous stage's output; record `<stage>_status` as `skipped_disabled`, `skipped_short`, or `skipped_too_long`.
- Final body over `TRUNCATE_TARGET_CHARS` → cut at a word boundary; record `truncate_status="truncated"` and `returned="truncated"`.

With `DIAGNOSTIC_FOOTER_ENABLED=false`, no footer is appended and fetch failures throw HTTP errors. Every other failure still degrades silently to the previous stage's output.

## Output and provider constraints

LLM stages:

- Each stage returns plain markdown, not JSON.
- Append XML diagnostics after the final stage only when `DIAGNOSTIC_FOOTER_ENABLED=true`.
- Never use the OpenAI `developer` role.
- Never use the OpenAI Responses API.

Fetch provider:

- Never use Firecrawl `onlyCleanContent`. Boilerplate stripping is controlled by `FIRECRAWL_ONLY_MAIN_CONTENT`.

## Compatibility goal

The LLM provider should work with local OpenAI-compatible servers such as llama.cpp, vLLM, and SGLang by using the lowest common denominator:

```json
{
  "model": "...",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ]
}
```

Sampler params (`temperature`, `top_p`, `top_k`, `min_p`, etc.) are not sent by default; operators add them via `LLM_EXTRA_BODY`, which is spread last into the request body.

## Quality gate

Keep the quality gate simple and deterministic. The code in `src/core/cleanup/quality-gate.ts` is the source of truth. `assessQuality(source, output, { minRatio, checkUrls })` rejects stage output that:

- is empty (reason `empty`),
- introduces URLs not present in the source when `checkUrls=true` (reason `unexpected_urls`),
- is not strictly smaller than the source (reason `ineffective`),
- shrinks below the per-stage `minRatio` (reason `too_small_ratio`).

Each stage passes its own `<STAGE>_QUALITY_MIN_RATIO` and its own `<STAGE>_CHECK_URLS`. The cascade falls back to the previous stage's output when a stage is rejected. There is no shared URL-check flag — clean defaults to `CLEAN_CHECK_URLS=true` (clean must preserve URLs verbatim), summarize defaults to `SUMMARIZE_CHECK_URLS=false` (summaries are intentionally lossy on link-heavy pages).

## Templates (Mustache)

All prompt and footer text lives in `templates/` and is rendered through `TemplateRenderer` (`src/core/cleanup/templates.ts`) using Mustache.

- `templates/clean.system.md` — clean stage system prompt.
- `templates/clean.user.md` — clean stage user prompt. Receives `url`, `title`, `content`.
- `templates/summarize.system.md` — summarize stage system prompt.
- `templates/summarize.user.md` — summarize stage user prompt. Receives the same `url`, `title`, `content` bag.
- `templates/footer.md` — the `<context_loader_info ... />` XML footer. Receives the snake_case variables produced by `footerVariables(info)` in `debug-footer.ts`.

Rules when changing templates or footer behaviour:

- Do not introduce a new template engine. Mustache stays.
- `Mustache.escape` is globally set to a no-op in `templates.ts`. Any XML/HTML escaping must be done by the caller before the values reach the template (see `escapeAttr` in `debug-footer.ts`).
- Add new footer fields by extending the per-stage footer type, mapping them in `footerVariables`, and exposing them as `{{#field}}...{{/field}}` sections in `footer.md`. Keep snake_case at the template boundary.
- Every LLM stage uses the same `{ url, title, content }` variable bag; this is intentional — it keeps stages swappable without bespoke template inputs.

## Security boundary tokens

Source comments mark security-relevant code paths with these noun phrases. Preserve them across refactors so concept-based search keeps working:

- `untrusted external content` — provider responses, template inputs.
- `security boundary` — auth, URL allowlisting, escaping, deserialisation.
- `XML attribute escaping` — `escapeAttr` in `debug-footer.ts`.
- `constant-time` — bearer-token comparison in `clients/auth.ts`.
- `sanitizeUpstreamCode` — provider error code slugification before logging or footer interpolation.

When you add a new security-relevant code path, mark it with the nearest matching phrase.

## Style

Favor boring, readable code. Keep functions small. Avoid clever abstractions. Do not add dependencies unless they materially simplify the code.

- File headers: every `src/**/*.ts` file starts with a short `//` header describing purpose, responsibilities, and key invariants. Pure re-export `index.ts` barrels are exempt.
- Exports per file: prefer one substantive top-level export per file. Additional exports should be simple helper types/functions.
- Import ordering: use three groups with one blank line between groups: `node:` built-ins, third-party packages, local imports. Sort alphabetically by module specifier within each group. Keep `import type` lines before value imports inside each group.

## Code comments

Comments help future readers (humans and agents) understand intent. They are not change-log entries.

- JSDoc is required on every exported function, every class method (including private), and every standalone function. Keep summaries concise and skip `@param`/`@returns` tags unless structurally necessary.
- Inline comments inside function/method bodies are not allowed. If a line needs a comment, refactor into clearer helpers or names.
- Mark security/safety boundaries explicitly with one of the grep tokens above.
- Do not write narrative or historical comments (`// recently added`, `// changed because`, `// previously used XYZ`). The git log carries history; comments stay timeless.
- Do not restate the code below the comment. If the comment paraphrases the next line, delete it.
- No `TODO` / `FIXME` / `XXX` in committed code. Open an issue instead.
- Do not use marketing words in comments (for example: "robust", "powerful", "elegant", "simple", "clean").
- Configuration schemas (`src/config/config.ts` and provider `*-env.ts`) require exactly two `//` lines above each key: line 1 explains purpose, line 2 states units/range/default.

## Release & branching

Full human-readable playbook lives in [docs/RELEASING.md](docs/RELEASING.md). The rules below are the binding contract for agents.

### Branches

- Single long-lived branch: `main`. Always deployable.
- Optional short-lived `feat/<topic>`, `fix/<topic>`, `chore/<topic>` branches. Use them only when the user asks for a PR or when a change needs more than one commit.
- Direct push to `main` is allowed by repository policy. Branch protection requires CI (`node`, `docker`) to pass before any PR is merged.

### Versioning

- SemVer with a `v` tag prefix (`v0.1.0`, `v0.2.0-rc.1`). While `0.x.y`, breaking changes can ship in a MINOR bump but must be called out in the release notes.
- **Never edit `package.json`'s `version` field by hand.** The only way to bump version is `npm version patch|minor|major|<explicit-version>`, which atomically edits `package.json`, commits, and tags.
- **Never run `git tag` directly.** Tags only come from `npm version`.

### Image channels (published by CI to `ghcr.io/sousekd/llm-context-loader`)

Releases and image tags are produced by `docker/metadata-action`; the table below is the binding spec the workflow encodes.

| Tag                | Published when                                          | Stability |
| ------------------ | ------------------------------------------------------- | --------- |
| `:X.Y.Z`           | Any `vX.Y.Z` tag (stable or pre-release)                | Immutable |
| `:X.Y`             | Stable `vX.Y.Z` tag only (no `-` in the tag name)       | Moves     |
| `:latest`          | Stable `vX.Y.Z` tag only (no `-` in the tag name)       | Moves     |
| `:edge`, `:main`   | Every push to `main` after CI passes                    | Moves     |

Pre-release tags (`vX.Y.Z-rc.N` etc.) publish only the immutable `:X.Y.Z-rc.N` and never move `:latest` or `:X.Y`.

- Releases are triggered by `.github/workflows/release.yml` on `v*.*.*` tags.
- `:edge`/`:main` are pushed by `.github/workflows/ci.yml` on every successful main build.
- Do not introduce a CHANGELOG.md; release notes are auto-generated by `softprops/action-gh-release` from Conventional Commits.

### Conventional Commits (required for agent-authored commits)

Format: `<type>(<optional scope>): <imperative summary>`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`. Breaking changes use `feat!: ...` or a `BREAKING CHANGE:` footer.

## Git workflow for agents

These verbs are the contract between the user and any AI assistant working on this repo. Map them to git operations exactly as listed below — nothing more, nothing less.

| User says…                       | Agent does                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "commit" / "commit this"          | `git add` the relevant files, `git commit -m "<conventional-commit message>"`. **No push.** If there is nothing to commit, say so and stop.                  |
| "push" / "ship it"                | If there are uncommitted relevant changes, commit them first as above. Then `git push` to the current branch. If the working tree is already clean and the local branch is ahead of `origin`, just push.                                                  |
| "release patch/minor/major"       | Verify the working tree is clean (commit first only if the user asked in the same turn). Run `npm version <bump>` (which executes `preversion` and aborts on failure), then `git push --follow-tags`. |
| "cut a pre-release X.Y.Z-rc.N"    | Verify the working tree is clean. Run `npm version X.Y.Z-rc.N`, then `git push --follow-tags`.                                |
| "promote to staging"              | No-op. Explain that every push to `main` already publishes `:edge`. Offer to push current work if it isn't pushed. |
| "pin the server to X.Y.Z"         | Update `LLMC_IMAGE_TAG` in the relevant `.env` or compose config. Do **not** ssh anywhere; tell the user to run `docker compose -f compose.deploy.yaml pull && docker compose -f compose.deploy.yaml up -d` on the server. |

Hard rules:

- Never run `git commit`, `git push`, `git tag`, or any other history-changing command unless the user has explicitly asked for it in the current turn. Staging changes and inspecting status/diffs is fine.
- Never run `git push --force`, `git reset --hard`, or anything that rewrites public history.
- Never edit `package.json`'s `version` field by hand. Never run `git tag` directly.
- Never publish container images locally. Only CI pushes to ghcr.io.
- After finishing a unit of work without an explicit verb, leave the working tree dirty and summarise what changed. The user will ask for a commit when they want one.
- When explicitly asked to commit, write the message yourself in the same call — do not ask for wording approval unless the change is genuinely ambiguous.

---

# Current scope

These constraints reflect the implementation that exists today. They are time-bound: they relax as items move out of the "deferred" list below.

**Do not lift exclusions here without first updating [docs/ROADMAP.md](docs/ROADMAP.md) and [README.md](README.md).**

Required endpoints (already implemented):

- `POST /` — Open WebUI external web loader contract. Body: `{ "urls": ["https://..."] }`. Return array of `{ page_content, metadata }`.
- `GET /r/<url>` — Jina Reader-style URL grab returning `text/markdown`. Also accepts `GET /r?url=<url>`. Compatibility is intentionally limited to URL-to-markdown; do not add Jina's optional request headers, alternate output formats, or other endpoints.
- `GET /health` — liveness probe. Always open.

The shape of the orchestration is:

```text
client POST/GET
  → Firecrawl /v2/scrape
    → clean stage (LlmStage, optional)        ─┬─ inside one limiters.llm slot
    → summarize stage (LlmStage, off by default) ─┘
    → truncate (TRUNCATE_TARGET_CHARS)
    → append <context_loader_info ... /> when DIAGNOSTIC_FOOTER_ENABLED=true
```

---

# Deferred features (do not implement without spec)

These are listed in [docs/ROADMAP.md](docs/ROADMAP.md). Do not add them in this scope. If one should land, update the roadmap and user-facing docs first, then implement.

- MCP server client (`load_url`, `ask_url`, `extract_fields`).
- CLI client.
- Ask/extract context modes (answer a question about a page instead of cleaning it).
- Additional fetch providers (Crawl4AI, Playwright, direct HTTP).
- Document providers (Docling for PDF/Office).
- Durable request queues, databases, persistent operational logs.
- Admin UI.
- Chunking, indexing, or retrieval — that is the caller's job.
