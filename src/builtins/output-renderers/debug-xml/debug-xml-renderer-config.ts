/**
 * Parses YAML configuration for the debug-xml output renderer.
 *
 * The configured root element becomes an XML diagnostic element name, so config
 * parsing validates it at the renderer security boundary before any request can
 * produce a footer.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined } from "../../../shared/config-coercion.js";
import { assertDiagnosticName } from "../../../shared/diagnostic-names.js";
import { ConfigurationError } from "../../../shared/errors.js";

const debugXmlRendererConfigSchema = z
  .object({
    rootElement: z.string().min(1).default("loader_info"),
    includeSkipped: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(false))
  })
  .strict();

/** Represents parsed config for the debug-xml output renderer. */
export type DebugXmlRendererConfig = z.infer<typeof debugXmlRendererConfigSchema>;

/** Parses opaque YAML config for the debug-xml output renderer. */
export function parseDebugXmlRendererConfig(raw: unknown): DebugXmlRendererConfig {
  const parsed = debugXmlRendererConfigSchema.parse(raw);
  try {
    assertDiagnosticName(parsed.rootElement);
  } catch (cause) {
    throw new ConfigurationError(`Invalid rootElement: ${parsed.rootElement}`, "invalid_renderer_root_element", {
      cause
    });
  }
  return parsed;
}
