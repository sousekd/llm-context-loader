import { z } from "zod";

import { boolish } from "../../../config/config.js";

// Firecrawl-specific environment schema used by provider selection.
// Parsed only when FETCH_PROVIDER=firecrawl.

const FirecrawlEnvSchema = z.object({
  // Base URL for Firecrawl scrape API endpoint resolution.
  // Units: URL string. Range: absolute URL. Default: http://firecrawl-api:3002.
  FIRECRAWL_BASE_URL: z.string().url().default("http://firecrawl-api:3002"),

  // Bearer token for Firecrawl authentication when required.
  // Units: string. Range: empty or non-empty token. Default: empty.
  FIRECRAWL_API_KEY: z.string().optional().default(""),

  // Toggle Firecrawl's onlyMainContent request flag for extraction scope.
  // Units: boolean. Range: true|false. Default: true.
  FIRECRAWL_ONLY_MAIN_CONTENT: boolish(true)
});

export type FirecrawlConfig = z.infer<typeof FirecrawlEnvSchema>;

/** Parse and validate Firecrawl-specific environment variables. */
export function parseFirecrawlEnv(env: NodeJS.ProcessEnv): FirecrawlConfig {
  const parsed = FirecrawlEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid Firecrawl configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
