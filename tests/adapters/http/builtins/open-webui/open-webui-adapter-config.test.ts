/** Verifies Open WebUI adapter configuration parsing. */
import { describe, expect, it } from "vitest";

import { parseOpenWebUiConfig } from "../../../../../src/adapters/http/builtins/open-webui/open-webui-adapter-config.js";

describe("parseOpenWebUiConfig", () => {
  it("defaults and coerces maxUrls without accepting blanks as zero", () => {
    expect(parseOpenWebUiConfig({})).toMatchObject({ path: "/", maxUrls: 20, auth: { bearerToken: "" } });
    expect(parseOpenWebUiConfig({ maxUrls: "5" })).toMatchObject({ maxUrls: 5 });
    expect(parseOpenWebUiConfig({ maxUrls: "" })).toMatchObject({ maxUrls: 20 });
  });

  it("rejects invalid maxUrls values", () => {
    expect(() => parseOpenWebUiConfig({ maxUrls: "0" })).toThrow();
    expect(() => parseOpenWebUiConfig({ maxUrls: "abc" })).toThrow();
  });
});
