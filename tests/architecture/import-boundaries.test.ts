/** Verifies source-level dependency boundaries. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(repoRoot, "src");

interface ImportEdge {
  readonly source: string;
  readonly target: string;
  readonly specifier: string;
  readonly line: number;
}

interface ClassifiedSource {
  readonly layer: SourceLayer;
  readonly component?: string;
}

type SourceLayer =
  | "adapter-http"
  | "bundles"
  | "builtins-content-transformer"
  | "builtins-http-adapter"
  | "builtins-output-renderer"
  | "builtins-pipeline-step"
  | "builtins-provider"
  | "app"
  | "config"
  | "core"
  | "engine"
  | "entry"
  | "contracts"
  | "shared";

describe("source import boundaries", () => {
  it("keeps local imports inside the allowed dependency graph", () => {
    expect(collectViolations()).toEqual([]);
  });

  it("keeps provider failure classification outside core", () => {
    const offenders = listTypeScriptFiles(path.join(sourceRoot, "core")).filter(sourcePath => {
      const text = readFileSync(sourcePath, "utf8");
      return text.includes("UpstreamError") || text.includes("classify-upstream-error");
    });

    expect(offenders.map(relativePath)).toEqual([]);
  });

  it("keeps deployment concerns outside engine", () => {
    const forbidden = [
      /fastify/i,
      /RawYamlConfig/,
      /yaml-config/,
      /from "\.\.\/bundles\//,
      /from "\.\.\/builtins\//,
      /from "\.\.\/app\//,
      /from "\.\.\/adapters\//
    ];
    const offenders = listTypeScriptFiles(path.join(sourceRoot, "engine")).filter(sourcePath => {
      const text = readFileSync(sourcePath, "utf8");
      return forbidden.some(pattern => pattern.test(text));
    });

    expect(offenders.map(relativePath)).toEqual([]);
  });

  it("keeps Fastify imports inside the HTTP adapter layer", () => {
    const offenders = listTypeScriptFiles(sourceRoot).filter(sourcePath => {
      const source = relativePath(sourcePath);
      if (source.startsWith("src/adapters/http/")) return false;
      return /^import .*from "fastify";/m.test(readFileSync(sourcePath, "utf8"));
    });

    expect(offenders.map(relativePath)).toEqual([]);
  });

  it("keeps contracts independent of core and Fastify", () => {
    const offenders = listTypeScriptFiles(path.join(sourceRoot, "contracts")).filter(sourcePath => {
      const text = readFileSync(sourcePath, "utf8");
      return (
        /^import .*from "fastify";/m.test(text) ||
        collectImportEdges(sourcePath).some(edge => edge.target.startsWith("src/core/"))
      );
    });

    expect(offenders.map(relativePath)).toEqual([]);
  });

  it("keeps concrete built-in aggregation in descriptor bundles", () => {
    const offenders = Array.from(groupConcreteBuiltinImportsBySource().entries())
      .filter(([, components]) => components.size > 1)
      .map(([source]) => source)
      .filter(source => !isDescriptorBundleSource(source));

    expect(offenders).toEqual([]);
  });

  it("keeps HTTP host and construction files independent of HTTP built-ins", () => {
    const offenders = collectAllImportEdges()
      .filter(edge => edge.source.startsWith("src/adapters/http/"))
      .filter(edge => !edge.source.startsWith("src/adapters/http/builtins/"))
      .filter(edge => edge.target.startsWith("src/adapters/http/builtins/"))
      .filter(edge => edge.source !== "src/adapters/http/descriptor-bundle.ts")
      .map(edge => `${edge.source}:${edge.line} imports ${edge.specifier} (${edge.target})`);

    expect(offenders).toEqual([]);
  });

  it("keeps YAML config translation out of engine construction internals", () => {
    const offenders = collectAllImportEdges()
      .filter(edge => edge.source.startsWith("src/config/yaml/") || edge.source === "src/config/app-config.ts")
      .filter(edge => edge.target.startsWith("src/engine/") && edge.target !== "src/engine/engine-config.ts")
      .map(edge => `${edge.source}:${edge.line} imports ${edge.specifier} (${edge.target})`);

    expect(offenders).toEqual([]);
  });
});

function collectViolations(): string[] {
  return collectAllImportEdges().flatMap(edge => validateImportEdge(edge));
}

function collectAllImportEdges(): ImportEdge[] {
  return listTypeScriptFiles(sourceRoot).flatMap(sourcePath => collectImportEdges(sourcePath));
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function collectImportEdges(sourcePath: string): ImportEdge[] {
  const text = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edges: ImportEdge[] = [];

  sourceFile.forEachChild(node => {
    const specifier = moduleSpecifierOf(node);
    if (!specifier?.startsWith(".")) return;
    const targetPath = resolveImportTarget(sourcePath, specifier);
    if (!targetPath?.startsWith(sourceRoot)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    edges.push({
      source: relativePath(sourcePath),
      target: relativePath(targetPath),
      specifier,
      line: position.line + 1
    });
  });

  return edges;
}

function moduleSpecifierOf(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  return undefined;
}

function resolveImportTarget(sourcePath: string, specifier: string): string | undefined {
  const targetBase = path.resolve(path.dirname(sourcePath), specifier);
  const candidates = [targetBase.replace(/\.js$/, ".ts"), `${targetBase}.ts`, path.join(targetBase, "index.ts")];
  return candidates.find(candidate => existsSync(candidate));
}

function validateImportEdge(edge: ImportEdge): string[] {
  const source = classifySource(edge.source);
  const target = classifySource(edge.target);
  if (isAllowedImport(edge, source, target)) return [];
  return [
    `${edge.source}:${edge.line} imports ${edge.specifier} (${edge.target}), violating ${source.layer} -> ${target.layer}`
  ];
}

function classifySource(sourcePath: string): ClassifiedSource {
  if (sourcePath.startsWith("src/shared/")) return { layer: "shared" };
  if (sourcePath.startsWith("src/bundles/")) return { layer: "bundles" };
  if (sourcePath.startsWith("src/engine/")) return { layer: "engine" };
  if (sourcePath.startsWith("src/core/")) return { layer: "core" };
  if (sourcePath.startsWith("src/contracts/")) return { layer: "contracts" };
  if (sourcePath.startsWith("src/adapters/http/builtins/"))
    return { layer: "builtins-http-adapter", component: httpAdapterComponent(sourcePath) };
  if (sourcePath.startsWith("src/adapters/http/")) return { layer: "adapter-http" };
  if (sourcePath.startsWith("src/builtins/source-providers/"))
    return { layer: "builtins-provider", component: providerComponent(sourcePath, "source") };
  if (sourcePath.startsWith("src/builtins/content-transformers/"))
    return { layer: "builtins-content-transformer", component: contentTransformerComponent(sourcePath) };
  if (sourcePath.startsWith("src/builtins/llm-providers/"))
    return { layer: "builtins-provider", component: providerComponent(sourcePath, "llm") };
  if (sourcePath.startsWith("src/builtins/pipeline-steps/"))
    return { layer: "builtins-pipeline-step", component: pipelineStepComponent(sourcePath) };
  if (sourcePath.startsWith("src/builtins/output-renderers/"))
    return { layer: "builtins-output-renderer", component: outputRendererComponent(sourcePath) };
  if (sourcePath.startsWith("src/app/")) return { layer: "app" };
  if (sourcePath.startsWith("src/config/")) return { layer: "config" };
  if (sourcePath === "src/main.ts") return { layer: "entry" };
  throw new Error(`Unclassified source path: ${sourcePath}`);
}

function isAllowedImport(edge: ImportEdge, source: ClassifiedSource, target: ClassifiedSource): boolean {
  switch (source.layer) {
    case "bundles":
      return [
        "builtins-content-transformer",
        "builtins-output-renderer",
        "builtins-pipeline-step",
        "builtins-provider",
        "bundles",
        "contracts",
        "shared"
      ].includes(target.layer);
    case "adapter-http":
      return (
        ["adapter-http", "config", "contracts", "shared"].includes(target.layer) ||
        isAllowedHttpLayerBuiltinImport(edge, target)
      );
    case "shared":
      return target.layer === "shared";
    case "core":
      return ["core", "contracts", "shared"].includes(target.layer);
    case "engine":
      return ["core", "contracts", "engine", "shared"].includes(target.layer);
    case "contracts":
      return ["contracts", "shared"].includes(target.layer);
    case "builtins-http-adapter":
      return (
        ["adapter-http", "contracts", "shared"].includes(target.layer) ||
        isAllowedBuiltinHttpAdapterImport(edge, source, target)
      );
    case "builtins-provider":
      return ["contracts", "shared"].includes(target.layer) || isSameComponent(source, target);
    case "builtins-content-transformer":
      return ["contracts", "shared"].includes(target.layer) || isSameComponent(source, target);
    case "builtins-pipeline-step":
      return ["contracts", "shared"].includes(target.layer) || isSameComponent(source, target);
    case "builtins-output-renderer":
      return ["contracts", "shared"].includes(target.layer) || isSameComponent(source, target);
    case "app":
      return ["adapter-http", "app", "bundles", "config", "engine", "contracts", "shared"].includes(target.layer);
    case "config":
      return ["config", "shared"].includes(target.layer) || isAllowedConfigEngineImport(edge, target);
    case "entry":
      return ["adapter-http", "app", "config", "entry", "contracts", "shared"].includes(target.layer);
  }
}

function isAllowedHttpLayerBuiltinImport(edge: ImportEdge, target: ClassifiedSource): boolean {
  return target.layer === "builtins-http-adapter" && edge.source === "src/adapters/http/descriptor-bundle.ts";
}

function isAllowedConfigEngineImport(edge: ImportEdge, target: ClassifiedSource): boolean {
  return target.layer === "engine" && edge.target === "src/engine/engine-config.ts";
}

function isAllowedBuiltinHttpAdapterImport(
  edge: ImportEdge,
  source: ClassifiedSource,
  target: ClassifiedSource
): boolean {
  if (target.layer !== "builtins-http-adapter") return false;
  if (isSameComponent(source, target)) return true;
  return edge.target === "src/adapters/http/builtins/auth.ts";
}

function groupConcreteBuiltinImportsBySource(): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>();
  for (const edge of collectAllImportEdges()) {
    const target = classifySource(edge.target);
    if (!isConcreteBuiltinLayer(target.layer) || target.component === undefined) continue;
    const components = grouped.get(edge.source) ?? new Set<string>();
    components.add(`${target.layer}:${target.component}`);
    grouped.set(edge.source, components);
  }
  return grouped;
}

function isConcreteBuiltinLayer(layer: SourceLayer): boolean {
  return [
    "builtins-content-transformer",
    "builtins-http-adapter",
    "builtins-output-renderer",
    "builtins-pipeline-step",
    "builtins-provider"
  ].includes(layer);
}

function isDescriptorBundleSource(sourcePath: string): boolean {
  return sourcePath.startsWith("src/bundles/") || sourcePath === "src/adapters/http/descriptor-bundle.ts";
}

function isSameComponent(source: ClassifiedSource, target: ClassifiedSource): boolean {
  return source.layer === target.layer && source.component !== undefined && source.component === target.component;
}

function httpAdapterComponent(sourcePath: string): string | undefined {
  const segments = sourcePath.split("/");
  return segments.length > 5 ? segments[4] : undefined;
}

function providerComponent(sourcePath: string, category: "llm" | "source"): string | undefined {
  const segments = sourcePath.split("/");
  return segments.length > 4 ? `${category}/${segments[3]}` : undefined;
}

function pipelineStepComponent(sourcePath: string): string | undefined {
  const segments = sourcePath.split("/");
  return segments.length > 4 ? segments[3] : undefined;
}

function contentTransformerComponent(sourcePath: string): string | undefined {
  const segments = sourcePath.split("/");
  return segments.length > 4 ? segments[3] : undefined;
}

function outputRendererComponent(sourcePath: string): string | undefined {
  const segments = sourcePath.split("/");
  return segments.length > 4 ? segments[3] : undefined;
}

function relativePath(filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
