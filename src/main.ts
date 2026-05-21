import { compose } from "./composition.js";
import { loadConfig } from "./config/config.js";
import { createLogger } from "./core/util/logger.js";
import { buildHttpApp } from "./http.js";

// Service entrypoint that loads config, composes dependencies, and starts HTTP.
// Also installs graceful shutdown handlers for process termination signals.
const config = loadConfig();
const logger = createLogger(config);
const composition = compose(config, process.env, logger);
const app = await buildHttpApp(composition, logger);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ event: "server.shutdown", signal }, "Shutting down");
    app.close().then(
      () => process.exit(0),
      (err) => {
        logger.error({ event: "server.shutdown_error", err }, "Error during shutdown");
        process.exit(1);
      }
    );
  });
}

await app.listen({ host: config.SERVER_HOST, port: config.SERVER_PORT });
logger.info({ event: "server.started", host: config.SERVER_HOST, port: config.SERVER_PORT }, "LLM Context Loader started");
