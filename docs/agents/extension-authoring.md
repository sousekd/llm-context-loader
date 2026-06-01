# Extension Authoring

This guide is for adding a new built-in implementation (source provider, LLM provider, pipeline step, output renderer, or HTTP adapter) inside this repository. Each category sits behind a small descriptor contract in its own folder, which keeps adding a built-in a localized change. Keep this guide and the live contracts in sync.

Read [docs/ARCHITECTURE.md](../ARCHITECTURE.md) and [architecture-rules.md](architecture-rules.md) first. This document assumes you already know the runtime flow, dependency graph, and the three host-capability surfaces.

## Common Shape

All five extension categories follow the same shape:

1. A small **runtime instance interface** under `src/contracts/extensions/`, `src/contracts/pipeline/`, or the adapter surface describing behavior only. These interfaces do not carry `name` or `type`.
2. A **descriptor** included by the appropriate descriptor bundle. Each descriptor declares:
   - `type`: the YAML `type` string.
   - `parseConfig(raw)`: implementation-local Zod schema parsing.
   - `create(args)`: factory returning a configured runtime instance.
3. A **`Resolved*` wrapper** (`src/contracts/extensions/resolved-extension.ts` for engine instances, `src/adapters/http/resolved-adapter.ts` for HTTP adapters) that pairs the bare runtime instance with its YAML identity (`name`, `type`). Engine and adapter builders produce these; runners consume `.provider`, `.adapter`, or `.renderer`.
4. A **`*CreateDeps`** shape `{ logger, tools }` passed to every factory.

The implementation class itself should accept only the things it actually needs. Do not store `name` or `type` on the class — that identity lives on the wrapper.

## Configuration Schema Patterns

YAML environment substitution runs before Zod parsing and substitutes placeholders as strings. If a numeric or boolean config field may be wired to an env placeholder, parse the scalar explicitly in the local schema with the shared preprocessors from `src/shared/config-coercion.ts`:

```ts
import { booleanStringAsBooleanOrUndefined, emptyStringAsUndefined } from "../../../shared/config-coercion.js";

const schema = z.object({
  maxItems: z.preprocess(emptyStringAsUndefined, z.coerce.number().int().positive().default(20)),
  enabled: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(false))
});
```

Use `emptyStringAsUndefined` around numeric fields with defaults or `.optional()` so blank env values do not silently become `0`. Use `booleanStringAsBooleanOrUndefined` instead of `z.coerce.boolean()`; JavaScript truthiness would parse `"false"` as `true`. Leave string secrets and tokens as strings when blank is meaningful. Leave opaque payloads such as provider-specific `extraBody` as YAML values; do not infer nested scalar types unless the field has a real schema.

## Construction Dependencies

Every `*CreateDeps` carries:

- `logger`: a pino child bound by engine or adapter construction with `{component, name}` (and `type` where relevant). Log through this logger; do not call `logger.child(...)` again for identity. Per-call fields go inline on each log call.
- `tools`: a `HostTools` bag. Pull host singletons by key:

```ts
import { httpFetchKey, resourceLoaderKey } from "../contracts/host/host-tools.js";

const httpFetch = args.deps.tools.require(httpFetchKey);
const resources = args.deps.tools.require(resourceLoaderKey);
```

Pipeline step factories additionally receive `services: ExtensionServices`. Resolve a registry by key and then look up by name:

```ts
import { sourceProviderRegistryKey } from "../contracts/extensions/source-provider.js";

const sourceProvider = args.services.require(sourceProviderRegistryKey).require(args.config.source).provider;
```

Note the `.provider` deref — registries hold `Resolved*` wrappers.

## Per-Category Notes

### Source Providers

Implement `SourceProvider` (`src/contracts/extensions/source-provider.ts`). The interface has `load(url, { signal }): Promise<SourceDocument>`. Throw `UpstreamError` for HTTP, parse, or empty-response failures (use the constructors in `src/shared/errors.ts`); let abort errors propagate. Built-in example: `src/builtins/source-providers/firecrawl/`.

### LLM Providers

Implement `LlmProvider` (`src/contracts/extensions/llm-provider.ts`). Same error rules as source providers. Built-in example: `src/builtins/llm-providers/openai-chat/`.

### Pipeline Steps

Implement `PipelineStep` (`src/contracts/pipeline/step.ts`): `run(ctx): Promise<StepResult>`.

Return shape (`StepResult`):

- `status: "ok" | "skipped" | "degraded" | "failed"`. Use `degraded` when the step completed its work but flagged a quality concern; use `failed` when the step could not complete.
- `reason?`: short stable string (snake_case) — surfaces in reports and log lines.
- `effects?`: requested mutations — `body`, `signals`, `artifacts`. Applied by the orchestrator in that order on `ok` or `degraded` status; `skipped` and `failed` results never apply effects.
- `diagnostics?`: `{ attributes?, children? }`. Observability-only. Surfaces in the persisted `StepReport` and the XML footer. Never visible to subsequent steps.

If a later step needs data produced by an earlier one, the earlier step must emit it as a `signal` (scalar coordination) or `artifact` (typed payload). `diagnostics` are observability-only and are never visible to subsequent steps via `ctx.outcomes` — do not rely on them for cross-step decisions.

Inter-step coordination uses `signals` (scalar) and `artifacts` (typed). Subsequent steps see compact `StepOutcome` values via `ctx.outcomes` — `StepOutcome` deliberately excludes diagnostics.

Classify caught `UpstreamError` and `AbortError` into stable `reason` values (e.g. `timeout`, `upstream_http`, `upstream_parse`); attach `upstream_code` / `upstream_status` under `diagnostics.attributes` for logging and the XML footer. See `src/builtins/pipeline-steps/load-source/load-source-step.ts` for the canonical classifier shape.

### Output Renderers

Implement `OutputRenderer` (`src/contracts/extensions/output-renderer.ts`): `render(input): OutputRendererResult | Promise<OutputRendererResult>`, where the result carries `markdown`. The pipeline runner calls one output renderer per completed pipeline run. Built-in examples: `src/builtins/output-renderers/debug-xml/`, `.../passthrough/`.

### HTTP Adapters

Implement `HttpAdapter` (`src/adapters/http/adapter-contracts.ts`): `register(server)`. Adapter construction gives each adapter a `PipelineHandle` already bound to its configured pipeline; call `handle.run(input)` per URL and `handle.renderFailure(input, error)` for per-URL synthetic failures. `PipelineHandle.renderFailure(...)` is owned by the engine runtime handle and should be used by HTTP adapters only to render adapter-level per-URL failures. Apply optional bearer auth using the shared helper in `src/adapters/http/builtins/auth.ts`. Built-in examples: `src/adapters/http/builtins/open-webui/`, `.../jina/`.

## Logging

The pino mixin merges request-context fields (`request_id`, `run_id`, `url`) into every log line. Do not log those fields by hand. Identity fields (`component`, `name`, `type`) are bound at construction by the engine or adapter layer. Per-call fields (`step`, `step_index`, `duration_ms`, `status`, `reason`, ...) are passed inline at each log call.

For full logging rules read [logging-and-errors.md](logging-and-errors.md).

## Errors

The intentional error taxonomy lives in `src/shared/errors.ts`:

- `ClientError` — caller mistake; HTTP returns 4xx.
- `ConfigurationError` — startup or app-assembly misconfiguration.
- `UpstreamError` — external provider failure; constructor sanitizes the upstream code.
- `InternalError` — bug or unexpected runtime failure.

Steps catch `UpstreamError` and `AbortError`, classify them into a stable `reason`, and report `status: "failed"`. Anything else thrown from a step is treated as an unexpected internal failure by the orchestrator.

## Diagnostic Name Validation

If your code emits diagnostic names (renderer root element, step name, attribute key, child node name), validate with `assertDiagnosticName` from `src/shared/diagnostic-names.ts`. The pattern is `^[a-z][a-z0-9_]*$`.

## Wiring

After implementing the descriptor:

1. Add it to the matching descriptor bundle. Engine descriptors go in `src/bundles/default-engine-descriptors.ts`; HTTP adapter descriptors go in `src/adapters/http/descriptor-bundle.ts`.
2. Add an example block to `config/llm-context-loader.yaml` if it changes default behavior, or describe usage in [CUSTOMIZATION.md](../CUSTOMIZATION.md).
3. Add unit tests under the mirrored test path: engine built-ins under `tests/builtins/...`, HTTP adapters under `tests/adapters/http/builtins/...`. Add an architecture-test allowance only if your implementation needs imports beyond the default allowlist (it usually does not).
4. Run `npm run build` and `npm test`.

Do not add a built-in directly to engine construction. The engine receives descriptor records from callers; bundle selection belongs to app assembly and adapter assembly.
