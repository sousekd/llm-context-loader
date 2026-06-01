/**
 * Pairs behavior-only HTTP adapter instances with configured identity.
 *
 * Adapter implementations do not expose their YAML name or descriptor type;
 * construction wrappers carry that identity for app assembly and future
 * inspection surfaces.
 */

import type { HttpAdapter } from "./adapter-contracts.js";

/** Pairs a configured HTTP adapter instance with its identity. */
export interface ResolvedHttpAdapter {
  readonly name: string;
  readonly type: string;
  readonly adapter: HttpAdapter;
}
