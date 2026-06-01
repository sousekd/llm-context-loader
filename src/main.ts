/**
 * Starts the hosted HTTP service from bootstrap environment and YAML config.
 *
 * The entrypoint owns process-level startup logging, Fastify listen, and graceful
 * shutdown. Runtime construction stays in app assembly and engine modules.
 */

import { buildHttpApp } from "./adapters/http/http-app.js";
import { composeApp } from "./app/compose.js";
import { loadEnvConfig } from "./config/env-config.js";
import { createLogger } from "./shared/logger.js";

let startupLogger = createLogger({ LOG_LEVEL: "info", LOG_PRETTY: "auto" });

try {
  await main();
} catch (error) {
  startupLogger.error({ component: "server", err: error }, "LLM Context Loader startup failed.");
  process.exit(1);
}

/** Composes and starts the HTTP service. */
async function main(): Promise<void> {
  const envConfig = loadEnvConfig();
  const logger = createLogger(envConfig);
  startupLogger = logger;
  logger.info({ component: "server" }, "LLM Context Loader starting...");
  const loaded = await composeApp({ envConfig, env: process.env, logger, httpFetch: globalThis.fetch });
  const app = await buildHttpApp(
    loaded.adapters.http.map(({ adapter }) => adapter),
    logger
  );

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      logger.info({ component: "server", signal }, "Shutting down...");
      app.close().then(
        () => {
          logger.info({ component: "server" }, "Shutdown complete.");
          process.exit(0);
        },
        (error: unknown) => {
          logger.error({ component: "server", err: error }, "Shutdown failed.");
          process.exit(1);
        }
      );
    });
  }

  await app.listen({ host: envConfig.HOST, port: envConfig.PORT });
  logger.info({ component: "server", host: envConfig.HOST, port: envConfig.PORT }, "LLM Context Loader started.");
}
