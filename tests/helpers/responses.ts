// Shared `Response` factory for provider tests that pass a fake `fetch`
// implementation. Defaults to a 200 application/json response; init fields
// merge on top so individual tests can override status, headers, etc.
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}
