/** Verifies bootstrap environment parsing. */
import { describe, expect, it } from "vitest";

import { loadEnvConfig } from "../../src/config/env-config.js";
import { ConfigurationError } from "../../src/shared/errors.js";

describe("loadEnvConfig", () => {
  it("uses current bootstrap defaults", () => {
    expect(loadEnvConfig({})).toMatchObject({
      CONFIG_FILE: "config/llm-context-loader.yaml",
      HOST: "0.0.0.0",
      PORT: 3010,
      LOG_LEVEL: "info",
      LOG_PRETTY: "auto"
    });
  });

  it("parses defaults and LOG_PRETTY values", () => {
    expect(loadEnvConfig({ CONFIG_FILE: "custom.yaml", HOST: "127.0.0.1", LOG_LEVEL: "debug" })).toMatchObject({
      CONFIG_FILE: "custom.yaml",
      HOST: "127.0.0.1",
      LOG_LEVEL: "debug"
    });
    expect(loadEnvConfig({ PORT: "4010" }).PORT).toBe(4010);
    expect(loadEnvConfig({ PORT: "" }).PORT).toBe(3010);
    expect(loadEnvConfig({ LOG_PRETTY: "true" }).LOG_PRETTY).toBe("true");
    expect(loadEnvConfig({ LOG_PRETTY: "false" }).LOG_PRETTY).toBe("false");
  });

  it("rejects invalid port values", () => {
    expect(() => loadEnvConfig({ PORT: "abc" })).toThrow(ConfigurationError);
  });

  it("rejects invalid LOG_PRETTY values", () => {
    expect(() => loadEnvConfig({ LOG_PRETTY: "maybe" })).toThrow(ConfigurationError);
  });
});
