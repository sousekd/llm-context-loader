# Logging And Errors

This note records the behavior agents need when touching logging, request context, error taxonomy, or pipeline diagnostics.

For dependency placement rules, read [architecture-rules.md](architecture-rules.md) first. Logging helpers belong in `src/shared/`, identity binding happens in construction layers, and runtime components should use the logger they receive.

## Error Types

Intentional errors live in `src/shared/errors.ts`.

- `ClientError` is for caller mistakes. The HTTP error handler surfaces it as a 4xx response with the configured code and message.
- `ConfigurationError` is for startup and app-assembly failures. It normally aborts startup rather than reaching runtime HTTP responses.
- `UpstreamError` is for external provider failures. It sanitizes the upstream code at construction time and carries optional upstream status.
- `InternalError` is for bugs and unexpected runtime failures. The HTTP error handler surfaces it as a 500 with a generic message.

`BaseError` is the abstract base for intentional errors.

The HTTP error handler preserves intentional `InternalError` instances. Unclassified request failures are wrapped as `InternalError` with code `unhandled_request_error` and the original thrown value stored as `cause`.

Descriptor `create(...)` failures during provider, renderer, pipeline step, or HTTP adapter construction are startup/app-assembly failures. Builders rethrow intentional `ConfigurationError` instances unchanged and wrap unclassified factory failures as contextual `ConfigurationError`s with the original thrown value stored as `cause`.

## Provider And Step Failures

Providers throw `UpstreamError` for upstream HTTP, parse, empty-response, and network failures. Providers let abort errors propagate.

Failure classification is step-local:

- `load-source` classifies `UpstreamError` and abort errors in `src/builtins/pipeline-steps/load-source/load-source-step.ts`.
- `llm-pass` classifies `UpstreamError` and abort errors in `src/builtins/pipeline-steps/llm-pass/llm-pass-step.ts`.
- Unknown thrown errors are handled by `PipelineOrchestrator` as unexpected step failures with reason `thrown`.

Do not add provider-specific failure classification to `src/core/`. The architecture test explicitly guards against core importing `UpstreamError`.

## Logger Identity And Correlation

Logging uses pino.

- Identity fields are bound at construction with `logger.child(...)` in engine and adapter construction paths.
- Runtime components use the logger they receive; they should not create child loggers themselves.
- Request correlation fields come from AsyncLocalStorage in `src/shared/request-context.ts` and are merged by the pino mixin in `src/shared/logger.ts`.
- HTTP requests get `request_id` in `src/adapters/http/http-app.ts`.
- Pipeline runs add `run_id` and `url` in `PipelineOrchestrator.run()`.

Common identity fields include `component`, `source_provider`, `llm_provider`, `http_adapter`, `output_renderer`, `pipeline`, `step`, `type`, and `step_index`.

Common per-call fields include `duration_ms`, `input_chars`, `output_chars`, `upstream_code`, `upstream_status`, `url_count`, `ok_count`, `degraded_count`, `failed_count`, and `err`.

Use snake_case for structured log fields.

## HTTP Edge Logging

`src/adapters/http/http-app.ts` disables Fastify request autologging. The app logs one non-health request line from the `onResponse` hook and shared warnings/errors from the error handler.

`GET /health` is silent at the request-line level.

## Output Diagnostics

Pipeline reports are built from step reports and body versions in `src/core/pipeline/report.ts`. The `debug-xml` output renderer serializes those reports through `src/builtins/output-renderers/debug-xml/footer-serializer.ts`. The `outputRenderer` is selected per pipeline in YAML.
