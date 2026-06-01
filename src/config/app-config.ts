/**
 * Defines the app-level configuration envelope produced by config sources.
 *
 * YAML translation separates engine-owned configuration from adapter-owned
 * declarations before app assembly wires descriptors, host tools, engine runtime,
 * and HTTP adapters together.
 */

import type { EngineConfig } from "../engine/engine-config.js";

/** Configures one HTTP adapter instance before adapter-specific parsing. */
export interface HttpAdapterConfigEntry {
  readonly type: string;
  readonly pipeline: string;
  readonly config?: unknown;
}

/** App-level config consumed by service assembly. */
export interface AppConfig {
  readonly engineConfig: EngineConfig;
  readonly adapters: {
    readonly http: Readonly<Record<string, HttpAdapterConfigEntry>>;
  };
  readonly metadata?: {
    readonly schemaVersion?: number;
  };
}
