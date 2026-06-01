# Security Boundaries

This note records the searchable markers and security-sensitive paths. Preserve these markers when refactoring nearby code, and add one when introducing a similar path.

## Search Tokens

Use the nearest existing phrase:

- `untrusted external content` for provider responses, user URLs, template inputs, and other external data.
- `security boundary` for auth, URL allowlisting, escaping, deserialization, and sanitization decisions.
- `XML attribute escaping` for XML diagnostic attribute escaping.
- `constant-time` for bearer-token comparison.
- `sanitizeUpstreamCode` for upstream error-code sanitization before logs or diagnostics.

## Boundary Files

- `src/adapters/http/builtins/auth.ts` validates inbound bearer tokens and uses constant-time comparison for equal-length tokens.
- `src/shared/urls.ts` validates user-supplied URLs and only accepts absolute `http:` and `https:` URLs.
- `src/shared/errors.ts` sanitizes upstream error identifiers in `UpstreamError` construction.
- `src/builtins/output-renderers/debug-xml/footer-serializer.ts` validates diagnostic names and escapes diagnostic XML attribute values.
- Provider implementations parse upstream responses as untrusted external content and convert failures to `UpstreamError`.
- Prompt templates receive page content as raw markdown. Mustache escaping is disabled intentionally in `src/shared/template-renderer.ts`.

## Agent Guidance

- Do not remove a security marker just because a nearby block was refactored.
- Keep security-sensitive code in its owning layer. HTTP auth stays under `src/adapters/http/`, URL validation and sanitization helpers stay framework-free, and provider response parsing stays in provider implementations.
- Do not interpolate raw upstream codes, URLs, titles, or provider messages into XML attributes without the existing serializer path.
- Do not broaden accepted URL schemes without an explicit product decision.
- Do not replace constant-time token comparison with direct string comparison.
- When adding a new upstream integration, sanitize external error identifiers before they appear in logs or rendered diagnostics.
