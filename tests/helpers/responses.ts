/** Provides fetch response fixtures for provider tests. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
    ...init
  });
}
