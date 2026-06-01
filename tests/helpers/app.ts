/** Provides Fastify app fixtures for HTTP adapter tests. */
import type { HttpAdapter } from "../../src/adapters/http/adapter-contracts.js";
import type { Logger } from "../../src/shared/logger.js";
import { buildHttpApp } from "../../src/adapters/http/http-app.js";
import { createTestLogger } from "./logger.js";

export async function buildTestHttpApp(args: {
  readonly httpAdapters: ReadonlyArray<HttpAdapter>;
  readonly logger?: Logger;
}): ReturnType<typeof buildHttpApp> {
  const logger = args.logger ?? createTestLogger();
  return buildHttpApp(args.httpAdapters, logger);
}
