/**
 * Defines the engine-owned runtime configuration shape.
 *
 * `EngineConfig` excludes adapter declarations, YAML schema metadata, and host
 * bootstrap settings. App assembly translates configuration sources into this
 * boundary before calling `createEngine`.
 */

/** Configures one named provider or output renderer instance. */
export interface EngineComponentConfig {
  readonly type: string;
  readonly config?: unknown;
}

/** Configures one pipeline step before descriptor-specific parsing. */
export interface EngineStepConfig {
  readonly type: string;
  readonly name: string;
  readonly concurrencyGroup?: string;
  readonly timeoutSeconds: number;
  readonly config?: unknown;
}

/** Configures one pipeline before runtime construction. */
export interface EnginePipelineConfig {
  readonly enabled: boolean;
  readonly outputRenderer: string;
  readonly limiters: Readonly<Record<string, number>>;
  readonly steps: ReadonlyArray<EngineStepConfig>;
}

/** Engine-only config. Excludes schema metadata and adapter configuration. */
export interface EngineConfig {
  readonly sourceProviders: Readonly<Record<string, EngineComponentConfig>>;
  readonly llmProviders: Readonly<Record<string, EngineComponentConfig>>;
  readonly outputRenderers: Readonly<Record<string, EngineComponentConfig>>;
  readonly pipelines: Readonly<Record<string, EnginePipelineConfig>>;
}
