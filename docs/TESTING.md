# Testing

The test suite mirrors `src/` and uses Vitest in Node mode. Keep tests shaped around current source behavior, not old test layout.

## Commands

- `npm test` runs `vitest run --coverage`.
- `npm run test:watch` starts Vitest watch mode.
- `npx vitest run tests/path/to/file.test.ts` runs one test file.
- `npm run typecheck:all` typechecks source and tests with `tsconfig.test.json`.
- `npm run format:check` checks Prettier formatting.

## Layout

- `tests/shared/` covers framework-free shared utilities.
- `tests/core/` covers pipeline runtime behavior.
- `tests/contracts/` contains reusable conformance helpers, not standalone test files.
- `tests/builtins/` mirrors built-in providers, renderers, and pipeline steps.
- `tests/adapters/http/` covers the Fastify host and HTTP adapter built-ins.
- `tests/engine/`, `tests/app/`, `tests/config/`, and `tests/bundles/` cover construction and configuration boundaries.
- `tests/architecture/` enforces source dependency boundaries.

Built-ins usually split tests by concern: `*-config.test.ts` for config parsing, `*-descriptor.test.ts` for descriptor wiring, and `*.test.ts` for runtime behavior.

## Helpers

- `tests/helpers/logger.ts` captures structured log calls through `createTestLogger()`.
- `tests/helpers/host-tools.ts` builds test `HostTools` with optional fetch/resource-loader doubles.
- `tests/helpers/app.ts` builds a Fastify app from HTTP adapter instances.
- `tests/helpers/pipeline.ts` builds pipeline results, compiled pipelines, renderers, and static pipeline handles.
- `tests/helpers/responses.ts` creates JSON `Response` objects for provider tests.
- `tests/builtins/pipeline-steps/utils.ts` builds direct `PipelineContext` fixtures for step tests.

## Conformance

Use conformance helpers when adding a compatible implementation:

- HTTP adapters bind `runHttpAdapterConformance(...)` from `tests/contracts/http-adapter-conformance.ts`.
- Output renderers call `assertOutputRendererConformance(...)` from `tests/contracts/output-renderer-conformance.ts`.
- Pipeline step descriptor tests call `assertPipelineStepIdentity(...)` and `assertPipelineStepRunsCleanly(...)` from `tests/contracts/pipeline-step-conformance.ts`.
