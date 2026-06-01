/**
 * Defines HTTP adapter extension contracts for inbound route implementations.
 *
 * HTTP adapters are terminal Fastify route plugins. They are constructed by app
 * assembly with an already-bound `PipelineHandle` and are not registered as
 * engine extension services for other factories to resolve.
 */

import type { FastifyInstance } from "fastify";

import type { HostTools } from "../../contracts/host/host-tools.js";
import type { PipelineHandle } from "../../contracts/pipeline/handle.js";
import type { Logger } from "../../shared/logger.js";

/** Represents the broad Fastify instance shape accepted by HTTP adapters. */
export type AnyFastifyInstance = FastifyInstance<any, any, any, any, any>;

/** Describes common parsed config every HTTP adapter provides. */
export interface HttpAdapterConfig {
  readonly path: string;
}

/** Defines an HTTP adapter route handler registered by the HTTP server. */
export interface HttpAdapter {
  /** Registers routes and hooks owned by this adapter. */
  register(server: AnyFastifyInstance): Promise<void> | void;
}

/** Provides dependencies available while constructing an HTTP adapter. */
export interface HttpAdapterCreateDeps {
  readonly logger: Logger;
  readonly tools: HostTools;
}

/** Provides arguments used to construct one HTTP adapter instance. */
export interface HttpAdapterCreateArgs<TConfig extends HttpAdapterConfig = HttpAdapterConfig> {
  readonly name: string;
  readonly type: string;
  readonly config: TConfig;
  readonly pipeline: PipelineHandle;
  readonly deps: HttpAdapterCreateDeps;
}

/** Defines one HTTP adapter implementation type. */
export interface HttpAdapterDescriptor<TConfig extends HttpAdapterConfig = HttpAdapterConfig> {
  readonly type: string;
  parseConfig(raw: unknown): TConfig;
  create(args: HttpAdapterCreateArgs<TConfig>): HttpAdapter | Promise<HttpAdapter>;
}
