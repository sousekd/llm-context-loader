import { z } from "zod";

// OpenAI-chat provider-specific environment schema.
// Empty today; retained for consistent provider parsing shape.

const OpenAiChatEnvSchema = z.object({});

export type OpenAiChatConfig = z.infer<typeof OpenAiChatEnvSchema>;

/** Parse and validate OpenAI-chat provider-specific environment variables. */
export function parseOpenAiChatEnv(env: NodeJS.ProcessEnv): OpenAiChatConfig {
  const parsed = OpenAiChatEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid OpenAI-chat configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
