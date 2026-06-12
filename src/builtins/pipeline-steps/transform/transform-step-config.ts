/**
 * Parses YAML configuration for the built-in transform pipeline step.
 *
 * The step is generic: `transformer` selects a configured content transformer
 * instance and `target` is the required output media type the step both requests
 * and asserts. `onUnsupported` decides whether an unhandled body skips or fails.
 */

import { z } from "zod";

import { booleanStringAsBooleanOrUndefined } from "../../../shared/config-coercion.js";

const transformStepConfigSchema = z
  .object({
    transformer: z.string().min(1, "transform step requires a transformer name"),
    target: z.string().min(1, "transform step requires a target media type"),
    onUnsupported: z.enum(["skip", "fail"]).default("skip"),
    onDeclined: z.enum(["skip", "fail"]).default("skip"),
    emitDiagnostics: z.preprocess(booleanStringAsBooleanOrUndefined, z.boolean().default(false))
  })
  .strict();

/** Represents parsed YAML configuration for a transform step. */
export type TransformStepConfig = z.infer<typeof transformStepConfigSchema>;

/** Describes constructor configuration for a transform step instance. */
export interface TransformStepOptions {
  readonly target: string;
  readonly onUnsupported: "skip" | "fail";
  readonly onDeclined: "skip" | "fail";
  readonly emitDiagnostics: boolean;
}

/** Parses transform step configuration from YAML. */
export function parseTransformStepConfig(raw: unknown): TransformStepConfig {
  return Object.freeze(transformStepConfigSchema.parse(raw));
}
