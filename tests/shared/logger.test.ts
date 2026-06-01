/** Verifies pino logger construction against request-context mixin behavior. */
import { describe, expect, it } from "vitest";

import { createLogger } from "../../src/shared/logger.js";
import { getRequestContext, runWithRequestContext } from "../../src/shared/request-context.js";

describe("createLogger", () => {
  it("does not mutate request context across log calls", () => {
    const logger = createLogger({ LOG_LEVEL: "info", LOG_PRETTY: "false" });

    runWithRequestContext({ request_id: "r1" }, () => {
      logger.info({ foo: 1 }, "first");
      expect(getRequestContext()).toEqual({ request_id: "r1" });

      logger.info({}, "second");
      expect(getRequestContext()).toEqual({ request_id: "r1" });
    });
  });
});
