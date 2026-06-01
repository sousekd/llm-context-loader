/**
 * Exposes the debug-xml output renderer descriptor to engine bundles.
 *
 * Renderer construction is intentionally small: config parsing validates XML
 * names, and runtime rendering is delegated to the renderer implementation.
 */

import { parseDebugXmlRendererConfig } from "./debug-xml-renderer-config.js";
import { DebugXmlRenderer } from "./debug-xml-renderer.js";

import type { OutputRendererDescriptor } from "../../../contracts/extensions/output-renderer.js";
import type { DebugXmlRendererConfig } from "./debug-xml-renderer-config.js";

/** Defines the built-in debug-xml output renderer type. */
export const debugXmlRendererDescriptor = {
  type: "debug-xml",
  parseConfig: parseDebugXmlRendererConfig,
  create: args => new DebugXmlRenderer(args.config, args.deps)
} satisfies OutputRendererDescriptor<DebugXmlRendererConfig>;
