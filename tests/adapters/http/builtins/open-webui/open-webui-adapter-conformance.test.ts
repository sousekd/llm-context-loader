/** Binds Open WebUI adapter behavior to the HTTP adapter conformance suite. */
import { OpenWebUiAdapter } from "../../../../../src/adapters/http/builtins/open-webui/open-webui-adapter.js";
import { createTestLogger } from "../../../../helpers/logger.js";
import { runHttpAdapterConformance } from "../../../../contracts/http-adapter-conformance.js";

runHttpAdapterConformance({
  name: "OpenWebUiAdapter",
  createAdapter: ({ bearerToken, handle }) =>
    new OpenWebUiAdapter(
      { path: "/", maxUrls: 20, auth: { bearerToken } },
      { pipeline: handle, logger: createTestLogger() }
    ),
  invokeBatch: (app, { urls, bearerToken }) => {
    const headers = bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined;
    return app.inject({ method: "POST", url: "/", headers, payload: { urls } });
  },
  invokeWithoutAuth: (app, { urls }) => app.inject({ method: "POST", url: "/", payload: { urls } }),
  failureCase: { url: "ftp://example.com" }
});
