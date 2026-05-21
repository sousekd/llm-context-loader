// Firecrawl response fragments consumed by the fetch provider wire adapter.
// Keeps parsing and optional-field checks strongly typed.
export interface FirecrawlResponse {
  success?: boolean;
  code?: string;
  error?: string;
  data?: {
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
}
