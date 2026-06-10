# Architecture

This document describes the internal architecture. The source code is the authority; this file is the map.

The structure is engine-first: `src/engine/` is the programmatic runtime boundary, HTTP is the first adapter surface, and YAML is the default deployment configuration source.

## Runtime Flow

Startup follows one path:

```text
src/main.ts
  -> loadEnvConfig()
  -> composeApp()
  -> createEngine()
  -> buildHttpApp()
  -> Fastify listen
```

At request time:

```text
HTTP adapter
  -> PipelineHandle bound to one compiled pipeline
  -> PipelineRunner
  -> PipelineOrchestrator
  -> configured OutputRenderer
  -> adapter response shape
```

`src/main.ts` parses bootstrap environment, creates the root logger, loads app assembly, builds Fastify, and installs shutdown handling. `src/adapters/http/http-app.ts` owns Fastify setup, request correlation, shared error handling, the silent `/health` route, and adapter registration.

`src/engine/create-engine.ts` is the programmatic engine boundary. It accepts `EngineConfig`, `EngineDescriptors`, `HostTools`, and a logger, then builds provider and output renderer registries, registers construction-time extension services, builds compiled pipelines internally, binds `PipelineHandle`s, and exposes `EngineRuntime`.

`src/app/compose.ts` is the service assembly point. It loads `AppConfig` from YAML, builds the host-tools bag, calls `createEngine(...)`, and creates HTTP adapter plugins over engine-provided pipeline handles. The composed result type is `ComposedApp` with two top-level keys: `adapters` (the `http` adapter set) and `registries` (`sourceProviders`, `llmProviders`, `outputRenderers`, and pipeline discovery info).

Additional adapter surfaces should start from `EngineRuntime` or host-level services above it, rather than adding a second provider/pipeline construction path.

## Source Layout

```text
src/
  shared/                    framework-free support: errors, logging, request context, URLs, limiters, templates, diagnostic name validation
  core/                      framework-free pipeline engine (orchestrator, runner, effects, body store); `core/pipeline/` mirrors `contracts/pipeline/`
  contracts/                 framework-free contracts grouped by intent
    pipeline/                pipeline ports and types: step, diagnostics, context, report, and handle definitions
    extensions/              source provider, LLM provider, output renderer, registry, and resolved wrapper contracts
    host/                    HostTools and ExtensionServices construction-time service contracts
  engine/                    programmatic engine API, EngineConfig, EngineRuntime, createEngine, and engine-local builders
  builtins/                  individual engine built-ins collected by descriptor bundles
    source-providers/
    llm-providers/
    pipeline-steps/
    output-renderers/
  adapters/
    http/                    Fastify host, HTTP adapter contracts, HTTP adapter builder, descriptor bundle, and HTTP built-ins
  bundles/                   default engine descriptor bundle selected by app assembly
  app/                       service assembly and host-tools/resource-loader builders
  config/                    bootstrap env schema, AppConfig envelope, YAML loading, and YAML-to-AppConfig translation
    yaml/                    YAML schema, file reading, environment substitution, and AppConfig translation
  main.ts                    process entry point
tests/                       mirrors src/ and enforces boundaries
scripts/                     developer smoke helpers
```

The current built-ins are:

- HTTP adapters: `open-webui`, `jina`.
- Source providers: `http`, `firecrawl`, `docling`.
- LLM providers: `openai-chat`.
- Pipeline steps: `load-source`, `llm-pass`, `truncate`, `capture-urls`, `verify-urls`.
- Output renderers: `debug-xml`, `passthrough`.

## Dependency Boundaries

The import graph is enforced by [tests/architecture/import-boundaries.test.ts](../tests/architecture/import-boundaries.test.ts). It is an allowlist by layer.

- `src/shared/` imports only shared code or external packages.
- `src/core/` imports only core, contracts, shared, or external packages.
- `src/contracts/` imports contracts, shared, or external packages. It stays Fastify-free.
- `src/engine/` imports only engine-local code, core, contracts, shared code, or external packages. It must not import YAML, HTTP, built-ins, bundles, Fastify, `RawYamlConfig`, `src/app/`, or `main.ts`.
- `src/adapters/http/` owns Fastify integration, HTTP adapter contracts, HTTP adapter construction, the HTTP descriptor bundle, and HTTP built-ins. Fastify imports are allowed only in this layer.
- `src/adapters/http/builtins/<name>/` may import its own files, the shared adapter auth helper, HTTP adapter contracts, contracts, shared code, or external packages.
- `src/builtins/source-providers/<impl>/` and `src/builtins/llm-providers/<impl>/` may import their own files, contracts, shared code, or external packages.
- `src/builtins/pipeline-steps/<type>/` may import their own files, contracts, shared code, or external packages.
- `src/builtins/output-renderers/<type>/` may import their own files, contracts, shared code, or external packages.
- `src/bundles/` collects engine built-in descriptors. It may import concrete engine built-ins, contracts, and shared helpers, but not HTTP adapter descriptors.
- `src/app/` is the service aggregation point. It may import descriptor bundles, HTTP adapter APIs, config schemas, engine APIs, contracts, and shared helpers.
- `src/config/` imports config-local code, engine config types, shared code, or external packages.
- `src/main.ts` stays above app and HTTP app assembly. It does not import concrete built-ins or core directly.

Descriptor bundles are the only files that aggregate multiple concrete built-in components. HTTP host and construction files do not import HTTP built-ins directly; [src/adapters/http/descriptor-bundle.ts](../src/adapters/http/descriptor-bundle.ts) is the HTTP built-in aggregation point.

When adding a top-level source layer, a new adapter surface, or a new category of built-in, update the architecture test in the same change. Unclassified source files should fail the architecture test rather than silently floating outside the graph.

One important boundary is explicit in the architecture test: `src/core/` must not import `UpstreamError` or own provider-failure classification. Provider-specific failures are classified by steps that know provider contracts.

## Core Pipeline

`src/core/` is the framework-free runtime engine. It does not know about Firecrawl, OpenAI, Open WebUI, Jina, or provider categories.

Key pieces:

- `PipelineStep` (`src/contracts/pipeline/step.ts`) is the executable step port: `run(ctx): Promise<StepResult>`.
- `PipelineContext` (`src/contracts/pipeline/context.ts`) exposes request input, abort signal, prior outcomes, body versions, scalar signals, and artifacts.
- `BodyStore` (`src/core/pipeline/body.ts`) owns immutable body versions. Steps read body state through the context but request mutations by returning effects.
- `StepResult` carries `status: "ok" | "skipped" | "degraded" | "failed"`, optional `reason`, `effects`, and `diagnostics`. Diagnostics are observability-only: they surface in the persisted `StepReport` and in renderers, but are never visible to later steps.
- `StepOutcome` (`src/contracts/pipeline/report.ts`) is the compact, semantic view later steps see via `PipelineContext.outcomes`; inter-step coordination uses `signals` and `artifacts`, not diagnostics. `StepReport` extends it with timing and a mirrored diagnostics payload.
- `applyStepEffects` applies effects on `ok` or `degraded` status (in body, signal, artifact order); `skipped` and `failed` results never apply effects. A `degraded` step may still carry effects, for example a quality gate rolling the body back to its previous version.
- `PipelineOrchestrator` runs one compiled pipeline for one URL, applies per-step timeouts, acquires concurrency-group limiters, records reports, and returns detached signal/artifact snapshots.
- `PipelineRunner` (`src/core/pipeline/runner.ts`) wraps the orchestrator and applies the pipeline's configured renderer, including a synthetic failure report for adapter-level per-URL failures.
- `OutputRenderer` (`src/contracts/extensions/output-renderer.ts`) is the runtime rendering port.

`ScalarValue` (signals, inter-step coordination) and `DiagnosticValue` (report attributes, observability) are structurally identical aliases kept distinct so the two channels can diverge later.

Concurrency groups are configured per pipeline. Adjacent steps with the same `concurrencyGroup` share one limiter acquisition. If another step is inserted between them, locking behavior changes because the adjacent group is split. `timeoutSeconds` applies to both limiter waiting and step execution; limiter waiting for an adjacent group uses the longest timeout in that group.

## Contracts And App Assembly

The repository uses a descriptor pattern for built-in implementation types. Each descriptor has:

- `type`: the YAML type string.
- `parseConfig(raw)`: implementation-local config parsing.
- `create(args)`: factory for a configured runtime instance.

The descriptor contracts live in `src/contracts/`. Runtime ports for provider categories and output renderers live under `src/contracts/extensions/`; pipeline concepts (steps, handles, contexts, results) live under `src/contracts/pipeline/`; host construction services live under `src/contracts/host/`. `src/core/pipeline/` contains only the framework-free runtime implementation that consumes those pipeline ports.

Runtime instance contracts (`SourceProvider`, `LlmProvider`, `OutputRenderer`, `HttpAdapter`, `PipelineStep`) are behavior-only — they do not carry `name` or `type`. Engine construction wraps provider and output renderer instances in small `Resolved*` values (`src/contracts/extensions/resolved-extension.ts`) that pair the bare instance with its configured identity (`name`, `type`). HTTP adapter construction still wraps adapters the same way via `src/adapters/http/resolved-adapter.ts`. Registries and `ComposedApp` enumerate these wrappers; runners reach the bare implementation via `.provider` / `.adapter` / `.renderer`.

Descriptor bundles are the only places that collect concrete built-in descriptors. The default engine bundle lives in `src/bundles/default-engine-descriptors.ts`; the hosted HTTP adapter bundle lives in `src/adapters/http/descriptor-bundle.ts`. There is no dynamic loading from disk.

The engine consumes caller-provided descriptor records. It never selects the default bundle, reads YAML, reads templates by itself, or chooses host dependencies such as `fetch`.

`ExtensionServices` is a typed construction-time service bag. The engine registers named provider and output renderer registries, and step factories resolve the registries they need by key. HTTP adapters are terminal Fastify route plugins and are not registered as extension services; app assembly gives each adapter a `PipelineHandle` resolved from `EngineRuntime`.

## Host Capabilities

The host exposes three distinct capability surfaces to extensions and core code:

| Concept                                                          | Location                  | Use for                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/*`                                                   | direct import             | **Stateless utilities.** Pure functions, framework-free helpers. Examples: `errors`, `urls`, `limiters`, `template-renderer`, `xml` name validation. |
| `HostTools` (`src/contracts/host/host-tools.ts`)                 | `deps.tools.require(key)` | **Stateful host singletons.** Resources, `httpFetch`, future clock/cache/metrics/persistence. Configured once by the host.                           |
| `ExtensionServices` (`src/contracts/host/extension-services.ts`) | `services.require(key)`   | **Named registries of user-configured instances.** Source providers, LLM providers, output renderers — operator declares N, picks by name.           |

Decision rule for adding a new "thing":

1. Stateless and host-agnostic? → `src/shared/`.
2. Stateful, configured by host, exactly one (or wants a testable seam)? → `HostTools`.
3. Operator declares N instances in YAML and picks one by name? → `ExtensionServices`.

All extension-author `*CreateDeps` (`PipelineStepCreateDeps`, `SourceProviderCreateDeps`, `LlmProviderCreateDeps`, `OutputRendererCreateDeps`, and HTTP-layer `HttpAdapterCreateDeps`) carry `{ logger, tools }`. Adding a new tool key never widens any descriptor contract.

## Configuration Model

Bootstrap environment is intentionally small and parsed by `src/config/env-config.ts`: `CONFIG_FILE`, `HOST`, `PORT`, `LOG_LEVEL`, and `LOG_PRETTY`.

The YAML document is translated to `AppConfig` before runtime construction:

1. `src/config/yaml/yaml-config.ts` validates the coarse YAML shape: `httpAdapters`, `outputRenderers`, `sourceProviders`, `llmProviders`, and `pipelines`.
2. `src/config/yaml/yaml-app-config.ts` maps engine-owned sections to `AppConfig.engineConfig`, HTTP adapter declarations to `AppConfig.adapters.http`, and `schemaVersion` to app metadata.
3. Each built-in descriptor parses its own `config` block with a local schema during engine or adapter construction.

YAML environment substitution happens before schema validation. See [CONFIGURATION.md](CONFIGURATION.md) for default operation and [CUSTOMIZATION.md](CUSTOMIZATION.md) for YAML structure.

`EngineConfig` excludes adapter declarations and schema metadata. `AppConfig` is the app-level envelope that pairs `engineConfig` with adapter configuration such as `adapters.http`.

## HTTP Layer

`src/adapters/http/http-app.ts` builds one Fastify app from configured adapter plugins. It disables Fastify request autologging, creates request IDs from `x-request-id` or a UUID, enters request context in `onRequest`, logs one non-health request line in `onResponse`, and handles shared errors.

HTTP adapters own their external contract:

- `open-webui` registers `POST /` by default, validates `{ urls: [...] }`, applies optional bearer auth, runs the pipeline once per URL, and returns Open WebUI document rows shaped as `{ page_content, metadata }`. Per-URL validation or rendered pipeline failures are returned as diagnostic rows inside the batch.
- `jina` registers `GET /r` and `GET /r/*` by default, accepts path or query URL forms, applies optional bearer auth, and returns `text/markdown`.

`/health` is registered by the HTTP host and is always unauthenticated.

## Error And Output Model

Shared intentional errors live in `src/shared/errors.ts`:

- `ClientError` represents caller mistakes and is surfaced as 4xx by the HTTP error handler.
- `ConfigurationError` represents startup or app-assembly misconfiguration.
- `UpstreamError` represents external provider failures and sanitizes upstream codes at construction.
- `InternalError` represents bugs or unexpected runtime failures.

Provider implementations throw `UpstreamError` for HTTP, parse, empty-response, and network failures, and let abort errors propagate. `load-source` and `llm-pass` classify `UpstreamError` and abort errors into step `reason` values. Other thrown errors are treated as unexpected by the orchestrator.

The `debug-xml` output renderer appends an XML diagnostic footer generated by `src/builtins/output-renderers/debug-xml/footer-serializer.ts`; if no body was produced, it returns the footer by itself. The `passthrough` output renderer returns body content without a footer, or the pipeline error message when a failed run produced no body. `outputRenderer` selection is per pipeline in YAML.

## Logging And Request Context

Logging uses pino. Identity fields are bound at construction by the engine and adapter builders with `logger.child(...)`; runtime components use the logger they were given. Request correlation fields are stored in AsyncLocalStorage by `src/shared/request-context.ts` and merged into log lines by the pino mixin in `src/shared/logger.ts`.

## Security Boundaries

Security-relevant paths are intentionally marked with searchable tokens. Current examples include URL validation in `src/shared/urls.ts`, constant-time bearer-token comparison in `src/adapters/http/builtins/auth.ts`, upstream-code sanitization in `src/shared/errors.ts`, and XML attribute escaping in `src/builtins/output-renderers/debug-xml/footer-serializer.ts`.

## Extension Surface

The code has internal extension-shaped contracts because YAML app assembly needs them. Each built-in category (source providers, LLM providers, output renderers, pipeline steps, HTTP adapters) sits behind a descriptor contract in its own folder, which keeps adding a built-in inside this repository a localized change. See [CUSTOMIZATION.md](CUSTOMIZATION.md) for the configurable surface those built-ins expose.
