import { describe, expect, it } from "vitest";

import { CLIENT_REGISTRY, clientNames, parseClientList } from "../../src/clients/registry.js";

describe("client registry", () => {
  it("returns built-in client names", () => {
    expect(clientNames().sort()).toEqual(["jina", "openwebui"]);
  });

  it("stores built-in clients as HTTP plugins", () => {
    expect(CLIENT_REGISTRY.openwebui.kind).toBe("http");
    expect(CLIENT_REGISTRY.jina.kind).toBe("http");
  });

  it("parses clients in configured order", () => {
    const result = parseClientList("jina, openwebui");

    expect(result.ok).toBe(true);
    expect(result.ok && result.clients.map((client) => client.name)).toEqual(["jina", "openwebui"]);
  });

  it("returns an empty list for operator opt-out values", () => {
    expect(parseClientList("")).toEqual({ ok: true, clients: [] });
    expect(parseClientList(undefined)).toEqual({ ok: true, clients: [] });
  });

  it("returns the first unknown client without throwing", () => {
    expect(parseClientList("openwebui,not_a_client,jina")).toEqual({ ok: false, unknown: "not_a_client" });
  });
});
