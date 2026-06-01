# Architecture Rules For Agents

Use this as the practical checklist before moving files, adding features, or changing imports. The complete map is [docs/ARCHITECTURE.md](../ARCHITECTURE.md), and the executable guard is [tests/architecture/import-boundaries.test.ts](../../tests/architecture/import-boundaries.test.ts).

## First Rule

Classify the file you are touching before editing it. If the change does not fit the file's layer, move the change to the owning layer instead of weakening the boundary.

## Layer Ownership

| Layer                | Owns                                                                                                     | Must Not Own                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/shared/`        | Framework-free utilities and error/logger/request-context helpers.                                       | Runtime construction, YAML loading, Fastify, concrete built-ins.                  |
| `src/contracts/`     | Engine-facing ports grouped by intent: `pipeline/`, `extensions/`, and `host/`.                          | Fastify, `src/core/`, YAML, app assembly.                                         |
| `src/core/`          | Framework-free pipeline execution primitives.                                                            | Provider categories, upstream classification policy, built-ins, adapters, YAML.   |
| `src/engine/`        | `EngineConfig`, `EngineRuntime`, `createEngine(...)`, engine-local runtime builders.                     | Built-ins, bundles, YAML, HTTP, Fastify, app assembly, process/bootstrap policy.  |
| `src/builtins/`      | Individual engine built-in implementations and descriptors.                                              | HTTP adapters, default bundle selection, app assembly.                            |
| `src/bundles/`       | Default engine descriptor aggregation.                                                                   | HTTP adapter descriptors, runtime construction, YAML loading.                     |
| `src/config/`        | Bootstrap env parsing, `AppConfig`, YAML reading/substitution/translation.                               | Engine construction internals, built-ins, Fastify, adapter implementations.       |
| `src/adapters/http/` | Fastify host, HTTP adapter contracts, HTTP adapter construction, HTTP descriptor bundle, HTTP built-ins. | Engine construction, compiled pipeline internals, non-HTTP adapter concerns.      |
| `src/app/`           | Service assembly: load AppConfig, build host tools, call `createEngine(...)`, wire adapters.             | Concrete implementation logic that belongs in built-ins, core execution behavior. |
| `src/main.ts`        | Process entry point, root logger, startup/listen/shutdown.                                               | Concrete built-ins, core, direct YAML shape manipulation.                         |

## Non-Negotiable Boundaries

- `src/engine/` must stay pure: no YAML, Fastify, HTTP adapters, built-ins, bundles, `RawYamlConfig`, `src/app/`, `src/main.ts`, filesystem config loading, or process bootstrap policy.
- `src/contracts/` must stay independent of Fastify and `src/core/`.
- `src/core/` must not classify provider failures or import `UpstreamError`; step implementations own provider-specific failure classification.
- Descriptor bundles are the only files that aggregate multiple concrete built-in descriptors.
- HTTP host and construction files must not import HTTP built-ins directly. Use `src/adapters/http/descriptor-bundle.ts` as the aggregation point.
- YAML code translates to `AppConfig`; it does not construct providers, output renderers, pipelines, or adapters.
- Adapters consume `EngineRuntime` or `PipelineHandle`; they do not consume `CompiledPipeline`, `PipelineRunner`, or `src/core/` internals.
- Additional adapter surfaces (such as CLI or MCP) belong above the engine boundary as adapters or host services.

## Placement Rules

- New source provider, LLM provider, pipeline step, or output renderer: put implementation and descriptor under `src/builtins/...`, add its descriptor to `src/bundles/default-engine-descriptors.ts` only when it belongs in the default service bundle, and test under `tests/builtins/...`.
- New HTTP adapter: put implementation, config, descriptor, and adapter-local helpers under `src/adapters/http/builtins/<name>/`, add it to `src/adapters/http/descriptor-bundle.ts` only when it belongs in the hosted default bundle, and test under `tests/adapters/http/builtins/<name>/`.
- New adapter surface such as MCP or CLI: create a sibling under `src/adapters/<surface>/`, consume `EngineRuntime` or `PipelineHandle`, and update the architecture test in the same change.
- New host singleton such as clock, cache, telemetry, persistence, or fetch policy: prefer a `HostTools` key in `src/contracts/host/host-tools.ts`, with the concrete host implementation wired from `src/app/`.
- New operator-declared implementation category: add a descriptor contract under `src/contracts/extensions/`, register configured instances through engine construction only if the engine needs them, and update docs and architecture tests.

## Validation Checklist

Run the narrowest useful checks while working, then broaden before handing off:

- `npm test -- tests/architecture/import-boundaries.test.ts` after moving files or changing imports.
- `npm run typecheck:all` after TypeScript shape changes.
- Focused tests for the layer you touched.
- `npm test` before considering a broad architecture change ready.

## Common Traps

- Do not solve an engine problem by importing a built-in into `src/engine/`; pass descriptors from the host instead.
- Do not solve an adapter problem by exposing compiled pipeline internals; expose a method on `EngineRuntime` or use a bound `PipelineHandle`.
- Do not add config fields straight to `EngineConfig` when they belong to an adapter or host service.
- Do not add a new top-level source directory without teaching the architecture test how to classify it.
