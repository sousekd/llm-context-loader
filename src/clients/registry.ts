import type { FastifyPluginAsync } from "fastify";

import type { AppConfig } from "../config/config.js";
import type { LoadContextUseCase } from "../core/use-cases/load-context.js";

import { jinaPlugin } from "./jina/route.js";
import { openWebUiPlugin } from "./openwebui/route.js";

// Client plugin registry resolved from the CLIENTS environment list.
// Supports typed expansion beyond HTTP via the plugin kind discriminator.

export interface ClientDeps {
  config: AppConfig;
  useCase: LoadContextUseCase;
}

export interface HttpClientPlugin {
  kind: "http";
  name: string;
  build(deps: ClientDeps): { plugin: FastifyPluginAsync<any>; options: object };
}

export type ClientPlugin = HttpClientPlugin;

export const CLIENT_REGISTRY: Record<string, ClientPlugin> = {
  openwebui: {
    kind: "http",
    name: "openwebui",
    build: (deps) => ({ plugin: openWebUiPlugin, options: { config: deps.config, useCase: deps.useCase } })
  },
  jina: {
    kind: "http",
    name: "jina",
    build: (deps) => ({ plugin: jinaPlugin, options: { config: deps.config, useCase: deps.useCase } })
  }
};

/** Return registered client names for diagnostics and validation. */
export function clientNames(): string[] {
  return Object.keys(CLIENT_REGISTRY);
}

/** Parse CLIENTS into ordered plugin entries or report the first unknown name. */
export function parseClientList(value: string | undefined): { ok: true; clients: ClientPlugin[] } | { ok: false; unknown: string } {
  const tokens = (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const out: ClientPlugin[] = [];
  for (const name of tokens) {
    const entry = CLIENT_REGISTRY[name];
    if (!entry) return { ok: false, unknown: name };
    out.push(entry);
  }
  return { ok: true, clients: out };
}
