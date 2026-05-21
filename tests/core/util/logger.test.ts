import { describe, expect, it } from "vitest";

import { createLogger } from "../../../src/core/util/logger.js";
import { buildTestConfig } from "../../helpers/index.js";

describe("createLogger", () => {
    it("returns a pino logger configured from LOG_LEVEL", () => {
        const logger = createLogger(buildTestConfig({ LOG_LEVEL: "silent" }));

        expect(logger.level).toBe("silent");
        expect(typeof logger.child).toBe("function");
    });
});
