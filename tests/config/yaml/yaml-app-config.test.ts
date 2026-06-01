/** Verifies YAML loading, environment substitution, and AppConfig translation. */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { substituteEnv } from "../../../src/config/yaml/env-substitution.js";
import { loadYamlAppConfig, yamlToAppConfig } from "../../../src/config/yaml/yaml-app-config.js";
import { rawYamlConfigSchema } from "../../../src/config/yaml/yaml-config.js";

describe("yamlToAppConfig", () => {
  it("separates engine config, adapter config, and metadata", () => {
    const raw = rawYamlConfigSchema.parse({
      schemaVersion: 1,
      sourceProviders: { source: { type: "source", config: { baseUrl: "https://source.example" } } },
      llmProviders: {},
      outputRenderers: { markdown: { type: "markdown", config: {} } },
      pipelines: { default: { outputRenderer: "markdown", limiters: {}, steps: [] } },
      httpAdapters: { owui: { type: "open-webui", pipeline: "default", config: { path: "/" } } }
    });

    const appConfig = yamlToAppConfig(raw);

    expect(appConfig.engineConfig).toEqual({
      sourceProviders: raw.sourceProviders,
      llmProviders: raw.llmProviders,
      outputRenderers: raw.outputRenderers,
      pipelines: raw.pipelines
    });
    expect(appConfig.adapters.http).toEqual(raw.httpAdapters);
    expect(appConfig.metadata?.schemaVersion).toBe(1);
  });
});

describe("loadYamlAppConfig", () => {
  it("loads, substitutes, validates, and translates YAML", async () => {
    const root = await mkdtemp(join(tmpdir(), "llmc-yaml-"));
    const configPath = join(root, "llm-context-loader.yaml");
    await writeFile(
      configPath,
      `schemaVersion: 1
outputRenderers:
  markdown:
    type: passthrough
pipelines:
  default:
    outputRenderer: markdown
    limiters:
      source: \${SOURCE_CONCURRENCY:-2}
httpAdapters:
  reader:
    type: jina
    pipeline: default
    config:
      path: /r
`,
      "utf8"
    );

    const loaded = await loadYamlAppConfig({ configPath, env: {} });

    expect(loaded.configDir).toBe(root);
    expect(loaded.appConfig.engineConfig.pipelines.default.limiters.source).toBe(2);
    expect(loaded.appConfig.adapters.http.reader.pipeline).toBe("default");
  });

  it("rejects unsupported schema versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "llmc-yaml-"));
    const configPath = join(root, "llm-context-loader.yaml");
    await writeFile(configPath, "schemaVersion: 2\n", "utf8");

    await expect(loadYamlAppConfig({ configPath, env: {} })).rejects.toThrow("Invalid YAML configuration shape");
  });
});

describe("substituteEnv", () => {
  it("supports required values, fallbacks, empty fallbacks, and literal escapes", () => {
    expect(
      substituteEnv(
        {
          required: "${REQUIRED}",
          fallback: "${MISSING:-fallback}",
          empty: "${EMPTY:-fallback}",
          literal: "$${REQUIRED}"
        },
        { REQUIRED: "value", EMPTY: "" }
      )
    ).toEqual({ required: "value", fallback: "fallback", empty: "fallback", literal: "${REQUIRED}" });
  });
});
