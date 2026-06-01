/** Verifies YAML-driven app composition. */
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { composeApp } from "../../src/app/compose.js";
import { loadEnvConfig } from "../../src/config/env-config.js";
import { createTestLogger, type CapturedLog } from "../helpers/logger.js";

describe("composeApp", () => {
  it("substitutes env, loads templates, and constructs runtime instances", async () => {
    const fixture = await writeConfigFixture(defaultYaml());
    const logs: CapturedLog[] = [];

    const loaded = await composeApp({
      envConfig: loadEnvConfig({ CONFIG_FILE: fixture.configPath, PORT: "3010" }),
      env: {
        FIRECRAWL_BASE_URL: "https://firecrawl.example",
        LLM_BASE_URL: "https://llm.example/v1",
        LLM_MODEL: "model",
        SOURCE_CONCURRENCY: "2",
        LLM_CONCURRENCY: "3"
      },
      logger: createTestLogger(logs),
      httpFetch: async () => new Response("{}")
    });

    expect(loaded.registries.sourceProviders.require("default-firecrawl").name).toBe("default-firecrawl");
    expect(loaded.registries.llmProviders.require("default-llm").name).toBe("default-llm");
    expect(
      loaded.registries.pipelines.find(pipeline => pipeline.name === "default")?.steps.map(entry => entry.name)
    ).toEqual(["firecrawl", "clean", "truncate"]);
    expect(loaded.adapters.http.map(adapter => adapter.name)).toEqual(["open-webui"]);
    expect(logs.some(log => log.level === "warn" && log.message === "Adapter bearer auth is disabled.")).toBe(true);
  });

  it("fails for missing required env and missing templates", async () => {
    const missingEnv = await writeConfigFixture(defaultYaml());
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: missingEnv.configPath }),
        env: {},
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("required env FIRECRAWL_BASE_URL not set");

    const missingTemplate = await writeConfigFixture(defaultYaml(), false);
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: missingTemplate.configPath }),
        env: {
          FIRECRAWL_BASE_URL: "https://firecrawl.example",
          LLM_BASE_URL: "https://llm.example/v1",
          LLM_MODEL: "model"
        },
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow();
  });

  it("rejects duplicate step names and unknown fields", async () => {
    const duplicate = await writeConfigFixture(defaultYaml().replace("name: truncate", "name: clean"));
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: duplicate.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("Duplicate step name");

    const unknownField = await writeConfigFixture(
      defaultYaml().replace("      maxAge: 0", "      maxAge: 0\n      mystery: true")
    );
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: unknownField.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow();
  });

  it("supports fallback, empty fallback, and literal substitution forms", async () => {
    const fixture = await writeConfigFixture(
      defaultYaml()
        .replace("apiKey: \${FIRECRAWL_API_KEY:-}", "apiKey: \${FIRECRAWL_API_KEY:-fallback-key}")
        .replace("model: \${LLM_MODEL}", () => "model: $${LLM_MODEL}")
    );
    let requestBody: Record<string, unknown> | undefined;
    const loaded = await composeApp({
      envConfig: loadEnvConfig({ CONFIG_FILE: fixture.configPath }),
      env: {
        FIRECRAWL_BASE_URL: "https://firecrawl.example",
        FIRECRAWL_API_KEY: "",
        LLM_BASE_URL: "https://llm.example/v1"
      },
      logger: createTestLogger(),
      httpFetch: async (_input, init) => {
        requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          headers: { "content-type": "application/json" }
        });
      }
    });

    await loaded.registries.llmProviders
      .require("default-llm")
      .provider.chat([], { signal: new AbortController().signal });

    expect(requestBody?.model).toBe("${LLM_MODEL}");
  });

  it("coerces env-substituted config scalars through schema parsers", async () => {
    const fixture = await writeConfigFixture(
      defaultYaml()
        .replace("onlyMainContent: true", "onlyMainContent: ${FIRECRAWL_ONLY_MAIN:-}")
        .replace("maxAge: 0", "maxAge: ${FIRECRAWL_MAX_AGE:-}")
        .replace("includeSkipped: true", "includeSkipped: ${DEBUG_XML_INCLUDE_SKIPPED:-}")
        .replace(
          "        config:\n          provider: default-llm",
          "        timeoutSeconds: ${CLEAN_TIMEOUT_SECONDS:-}\n        config:\n          provider: default-llm"
        )
        .replace("minInputChars: 1", "minInputChars: ${MIN_INPUT_CHARS:-}")
        .replace("maxInputChars: 100", "maxInputChars: ${MAX_INPUT_CHARS:-}")
    );
    let firecrawlRequestBody: Record<string, unknown> | undefined;
    const loaded = await composeApp({
      envConfig: loadEnvConfig({ CONFIG_FILE: fixture.configPath }),
      env: {
        FIRECRAWL_BASE_URL: "https://firecrawl.example",
        FIRECRAWL_ONLY_MAIN: "false",
        FIRECRAWL_MAX_AGE: "",
        LLM_BASE_URL: "https://llm.example/v1",
        LLM_MODEL: "model",
        DEBUG_XML_INCLUDE_SKIPPED: "false",
        CLEAN_TIMEOUT_SECONDS: "",
        MIN_INPUT_CHARS: "",
        MAX_INPUT_CHARS: ""
      },
      logger: createTestLogger(),
      httpFetch: async (_input, init) => {
        firecrawlRequestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(JSON.stringify({ data: { markdown: "loaded" } }), {
          headers: { "content-type": "application/json" }
        });
      }
    });

    expect(
      loaded.registries.pipelines
        .find(pipeline => pipeline.name === "default")
        ?.steps.find(step => step.name === "clean")?.timeoutSeconds
    ).toBe(60);

    await loaded.registries.sourceProviders
      .require("default-firecrawl")
      .provider.load("https://example.com", { signal: new AbortController().signal });

    expect(firecrawlRequestBody).toMatchObject({ onlyMainContent: false, maxAge: 0 });
  });

  it("rejects unknown registry references and invalid diagnostic names", async () => {
    const unknownProvider = await writeConfigFixture(defaultYaml().replace("type: firecrawl", "type: nowhere"));
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: unknownProvider.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("Unknown source provider type");

    const unknownStep = await writeConfigFixture(defaultYaml().replace("type: truncate", "type: mystery"));
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: unknownStep.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("Unknown step type");

    const unknownAdapter = await writeConfigFixture(defaultYaml().replace("type: open-webui", "type: mystery"));
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: unknownAdapter.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("Unknown HTTP adapter type");

    const unknownPipeline = await writeConfigFixture(defaultYaml().replace("pipeline: default", "pipeline: missing"));
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: unknownPipeline.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow("Unknown pipeline");

    const invalidRoot = await writeConfigFixture(
      defaultYaml().replace("rootElement: loader_info", "rootElement: ContextLoader")
    );
    await expect(
      composeApp({
        envConfig: loadEnvConfig({ CONFIG_FILE: invalidRoot.configPath }),
        env: envValues(),
        logger: createTestLogger(),
        httpFetch: fetch
      })
    ).rejects.toThrow(/Invalid rootElement/);
  });
});

async function writeConfigFixture(yaml: string, writeTemplates = true): Promise<{ configPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "llmc-config-"));
  await mkdir(join(root, "config"));
  if (writeTemplates) {
    await mkdir(join(root, "templates"));
    await writeFile(join(root, "templates", "clean.system.md"), "system {{url}}", "utf8");
    await writeFile(join(root, "templates", "clean.user.md"), "user {{content}}", "utf8");
  }
  const configPath = join(root, "config", "llm-context-loader.yaml");
  await writeFile(configPath, yaml, "utf8");
  return { configPath };
}

function envValues(): NodeJS.ProcessEnv {
  return {
    FIRECRAWL_BASE_URL: "https://firecrawl.example",
    LLM_BASE_URL: "https://llm.example/v1",
    LLM_MODEL: "model"
  };
}

function defaultYaml(): string {
  return `sourceProviders:
  default-firecrawl:
    type: firecrawl
    config:
      baseUrl: \${FIRECRAWL_BASE_URL}
      apiKey: \${FIRECRAWL_API_KEY:-}
      onlyMainContent: true
      formats: [markdown]
      maxAge: 0
llmProviders:
  default-llm:
    type: openai-chat
    config:
      baseUrl: \${LLM_BASE_URL}
      apiKey: \${LLM_API_KEY:-}
      model: \${LLM_MODEL}
      extraBody: {}
outputRenderers:
  debug-xml:
    type: debug-xml
    config:
      rootElement: loader_info
      includeSkipped: true
pipelines:
  default:
    outputRenderer: debug-xml
    limiters:
      source: \${SOURCE_CONCURRENCY:-4}
      llm: \${LLM_CONCURRENCY:-1}
    steps:
      - type: load-source
        name: firecrawl
        concurrencyGroup: source
        config:
          provider: default-firecrawl
      - type: llm-pass
        name: clean
        concurrencyGroup: llm
        config:
          provider: default-llm
          minInputChars: 1
          maxInputChars: 100
          templates:
            system: ../templates/clean.system.md
            user: ../templates/clean.user.md
      - type: truncate
        name: truncate
        config:
          targetChars: 100
httpAdapters:
  open-webui:
    type: open-webui
    pipeline: default
    config:
      auth:
        bearerToken: \${OWUI_AUTH_TOKEN:-}
`;
}
