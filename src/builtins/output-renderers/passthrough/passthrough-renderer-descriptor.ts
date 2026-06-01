/**
 * Exposes the passthrough output renderer descriptor to engine bundles.
 *
 * The runtime renderer has no dependencies and simply returns the current body
 * or a visible failure message when the run failed before producing content.
 */

import { parsePassthroughRendererConfig } from "./passthrough-renderer-config.js";
import { PassthroughRenderer } from "./passthrough-renderer.js";

import type { OutputRendererDescriptor } from "../../../contracts/extensions/output-renderer.js";
import type { PassthroughRendererConfig } from "./passthrough-renderer-config.js";

/** Defines the built-in passthrough output renderer type. */
export const passthroughRendererDescriptor = {
  type: "passthrough",
  parseConfig: parsePassthroughRendererConfig,
  create: () => new PassthroughRenderer()
} satisfies OutputRendererDescriptor<PassthroughRendererConfig>;
