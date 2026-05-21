import { z } from "zod";

// Core environment-variable contract shared by all deployments.
// Provider-specific keys remain in provider-local env schema modules.

/** Parse optional bool-like env values with a configured default fallback. */
export const boolish = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === "") return defaultValue;
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected boolean-like value" });
      return z.NEVER;
    });

/** Parse optional integer env values with a configured default fallback. */
export const intish = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === "") return defaultValue;
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed) && String(parsed) === value.trim()) return parsed;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected integer value" });
      return z.NEVER;
    });

/** Parse optional numeric env values with a configured default fallback. */
export const numberish = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === "") return defaultValue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected numeric value" });
      return z.NEVER;
    });

/** Parse optional JSON-object env values with a configured default fallback. */
export const jsonObjectish = (defaultValue: Record<string, unknown>) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === "") return defaultValue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected JSON object value" });
        return z.NEVER;
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected JSON object value" });
        return z.NEVER;
      }
      return parsed as Record<string, unknown>;
    });

const EnvSchema = z.object({
  // Host interface Fastify binds to for inbound HTTP.
  // Units: hostname/IP string. Range: non-empty string. Default: 0.0.0.0.
  SERVER_HOST: z.string().default("0.0.0.0"),

  // Port Fastify listens on for inbound HTTP traffic.
  // Units: TCP port number. Range: integer. Default: 3010.
  SERVER_PORT: intish(3010),

  // Minimum log level emitted by the process logger.
  // Units: enum string. Range: trace|debug|info|warn|error|fatal|silent. Default: info.
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),

  // Enable bearer-token authentication on client-facing routes.
  // Units: boolean. Range: true|false. Default: false.
  AUTH_ENABLED: boolish(false),

  // Shared bearer token expected in Authorization header when auth is enabled.
  // Units: string. Range: empty or non-empty secret. Default: empty.
  API_KEY: z.string().optional().default(""),

  // Enable diagnostic footer appending and fetch-failure diagnostic fallback responses.
  // Units: boolean. Range: true|false. Default: true.
  DIAGNOSTIC_FOOTER_ENABLED: boolish(true),

  // Ordered client plugin list used for route registration at startup.
  // Units: comma-separated string. Range: known client names or empty. Default: openwebui,jina.
  CLIENTS: z.string().optional().default("openwebui,jina"),

  // Fetch provider identifier selected by composition root.
  // Units: enum string. Range: firecrawl. Default: firecrawl.
  FETCH_PROVIDER: z.literal("firecrawl").optional().default("firecrawl"),

  // Timeout budget for one upstream fetch request.
  // Units: seconds. Range: integer >= 0. Default: 60.
  FETCH_TIMEOUT_SECONDS: intish(60).pipe(z.number().int().min(0)),

  // Max concurrent fetch operations across all requests.
  // Units: count. Range: integer >= 1. Default: 4.
  FETCH_CONCURRENCY: intish(4).pipe(z.number().int().min(1)),

  // LLM provider identifier selected by composition root.
  // Units: enum string. Range: openai_chat. Default: openai_chat.
  LLM_PROVIDER: z.literal("openai_chat").optional().default("openai_chat"),

  // Base URL for OpenAI-compatible chat completions endpoint.
  // Units: URL string. Range: absolute URL. Default: http://localhost:8080/v1.
  LLM_BASE_URL: z.string().url().default("http://localhost:8080/v1"),

  // Bearer token for LLM upstream authentication when required.
  // Units: string. Range: empty or non-empty token. Default: empty.
  LLM_API_KEY: z.string().optional().default(""),

  // Model identifier sent on chat completion requests.
  // Units: string. Range: non-empty string. Default: local-model.
  LLM_MODEL: z.string().default("local-model"),

  // Context-window budget used for stage eligibility projection.
  // Units: tokens. Range: integer >= 0. Default: 131072.
  LLM_CONTEXT_TOKENS: intish(131072).pipe(z.number().int().min(0)),

  // Character-to-token divisor for rough token estimation.
  // Units: chars per token. Range: number > 0 recommended. Default: 4.
  LLM_CHARS_PER_TOKEN: numberish(4),

  // Max concurrent per-URL LLM workflows across all requests.
  // Units: count. Range: integer >= 1. Default: 1.
  LLM_CONCURRENCY: intish(1).pipe(z.number().int().min(1)),

  // Extra fields merged into every chat-completions request body (e.g. sampler params).
  // Units: JSON object string. Range: any JSON object; wins for every key. Default: {}.
  LLM_EXTRA_BODY: jsonObjectish({}),

  // Enable or disable the clean stage for fetched markdown.
  // Units: boolean. Range: true|false. Default: true.
  CLEAN_ENABLED: boolish(true),

  // Minimum compacted input length required before clean stage runs.
  // Units: characters. Range: integer >= 0. Default: 500.
  CLEAN_MIN_INPUT_CHARS: intish(500).pipe(z.number().int().min(0)),

  // Maximum compacted input length allowed for clean stage.
  // Units: characters. Range: integer >= 0; 0 means no limit. Default: 75000.
  CLEAN_MAX_INPUT_CHARS: intish(75000).pipe(z.number().int().min(0)),

  // Output token budget ratio reserved for the clean stage in context-window eligibility projection.
  // Units: ratio. Range: number >= 0. Default: 0.5.
  CLEAN_OUTPUT_RATIO: numberish(0.5).pipe(z.number().min(0)),

  // Timeout budget for one clean-stage LLM request.
  // Units: seconds. Range: integer >= 0. Default: 60.
  CLEAN_TIMEOUT_SECONDS: intish(60).pipe(z.number().int().min(0)),

  // Minimum output/input ratio accepted by clean-stage quality gate.
  // Units: ratio. Range: number >= 0. Default: 0.02.
  CLEAN_QUALITY_MIN_RATIO: numberish(0.02).pipe(z.number().min(0)),

  // Toggle clean-stage rejection when output introduces new URLs.
  // Units: boolean. Range: true|false. Default: true.
  CLEAN_CHECK_URLS: boolish(true),

  // Enable or disable summarize stage after clean stage.
  // Units: boolean. Range: true|false. Default: false.
  SUMMARIZE_ENABLED: boolish(false),

  // Minimum compacted input length required before summarize stage runs.
  // Units: characters. Range: integer >= 0. Default: 25000.
  SUMMARIZE_MIN_INPUT_CHARS: intish(25000).pipe(z.number().int().min(0)),

  // Maximum compacted input length allowed for summarize stage.
  // Units: characters. Range: integer >= 0; 0 means no limit. Default: 0.
  SUMMARIZE_MAX_INPUT_CHARS: intish(0).pipe(z.number().int().min(0)),

  // Output token budget ratio reserved for the summarize stage in context-window eligibility projection.
  // Units: ratio. Range: number >= 0. Default: 0.15.
  SUMMARIZE_OUTPUT_RATIO: numberish(0.15).pipe(z.number().min(0)),

  // Timeout budget for one summarize-stage LLM request.
  // Units: seconds. Range: integer >= 0. Default: 60.
  SUMMARIZE_TIMEOUT_SECONDS: intish(60).pipe(z.number().int().min(0)),

  // Minimum output/input ratio accepted by summarize-stage quality gate.
  // Units: ratio. Range: number >= 0. Default: 0.01.
  SUMMARIZE_QUALITY_MIN_RATIO: numberish(0.01).pipe(z.number().min(0)),

  // Toggle summarize-stage rejection when output introduces new URLs.
  // Units: boolean. Range: true|false. Default: false.
  SUMMARIZE_CHECK_URLS: boolish(false),

  // Hard cap applied to final response body before optional footer append.
  // Units: characters. Range: integer >= 0; 0 disables truncation. Default: 25000.
  TRUNCATE_TARGET_CHARS: intish(25000).pipe(z.number().int().min(0)),

  // Filesystem directory containing prompt and footer templates.
  // Units: path string. Range: readable directory path. Default: ./templates.
  TEMPLATE_DIR: z.string().default("./templates"),

  // Filename for clean stage system prompt template.
  // Units: filename string. Range: template file in TEMPLATE_DIR. Default: clean.system.md.
  CLEAN_SYSTEM_TEMPLATE: z.string().default("clean.system.md"),

  // Filename for clean stage user prompt template.
  // Units: filename string. Range: template file in TEMPLATE_DIR. Default: clean.user.md.
  CLEAN_USER_TEMPLATE: z.string().default("clean.user.md"),

  // Filename for summarize stage system prompt template.
  // Units: filename string. Range: template file in TEMPLATE_DIR. Default: summarize.system.md.
  SUMMARIZE_SYSTEM_TEMPLATE: z.string().default("summarize.system.md"),

  // Filename for summarize stage user prompt template.
  // Units: filename string. Range: template file in TEMPLATE_DIR. Default: summarize.user.md.
  SUMMARIZE_USER_TEMPLATE: z.string().default("summarize.user.md"),

  // Filename for diagnostic footer template.
  // Units: filename string. Range: template file in TEMPLATE_DIR. Default: footer.md.
  FOOTER_TEMPLATE: z.string().default("footer.md")
});

export type AppConfig = z.infer<typeof EnvSchema>;

/** Parse and validate runtime environment variables into AppConfig. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.message}`);
  }

  if (parsed.data.AUTH_ENABLED && !parsed.data.API_KEY) {
    throw new Error("AUTH_ENABLED=true requires API_KEY");
  }

  return parsed.data;
}
