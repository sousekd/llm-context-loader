/** Binds Jina adapter behavior to the HTTP adapter conformance suite. */
import { JinaAdapter } from "../../../../../src/adapters/http/builtins/jina/jina-adapter.js";
import { createTestLogger } from "../../../../helpers/logger.js";
import { runHttpAdapterConformance } from "../../../../contracts/http-adapter-conformance.js";

runHttpAdapterConformance({
  name: "JinaAdapter",
  createAdapter: ({ bearerToken, handle }) =>
    new JinaAdapter({ path: "/r", auth: { bearerToken } }, { pipeline: handle, logger: createTestLogger() }),
  invokeBatch: (app, { urls, bearerToken }) => {
    const headers = bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined;
    return app.inject({ method: "GET", url: `/r/${urls[0]}`, headers });
  },
  invokeWithoutAuth: (app, { urls }) => app.inject({ method: "GET", url: `/r/${urls[0]}` })
});
