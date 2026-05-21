import { describe, expect, it } from "vitest";

import { compose } from "../../src/composition.js";
import { AppError } from "../../src/core/util/errors.js";
import { buildTestConfig, silentLogger } from "../helpers/index.js";

describe("compose", () => {
  it("returns clients listed in CLIENTS order", () => {
    const composition = compose(buildTestConfig({ CLIENTS: "jina, openwebui" }), {} as NodeJS.ProcessEnv, silentLogger());

    expect(composition.clients.map((client) => client.name)).toEqual(["jina", "openwebui"]);
  });

  it("returns no clients when CLIENTS is empty", () => {
    const composition = compose(buildTestConfig({ CLIENTS: "" }), {} as NodeJS.ProcessEnv, silentLogger());

    expect(composition.clients).toEqual([]);
  });

  it("throws unsupported_client for unknown names", () => {
    expect(() => compose(buildTestConfig({ CLIENTS: "openwebui,unknown_client" }), {} as NodeJS.ProcessEnv, silentLogger()))
      .toThrow(expect.objectContaining({ code: "unsupported_client", statusCode: 500 }));
    expect(() => compose(buildTestConfig({ CLIENTS: "unknown_client" }), {} as NodeJS.ProcessEnv, silentLogger()))
      .toThrow(AppError);
  });
});
