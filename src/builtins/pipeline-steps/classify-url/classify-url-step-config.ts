/**
 * Parses YAML configuration for the built-in classify-url pipeline step.
 *
 * Rules define URL classification: each rule has one signal name and exactly
 * one matcher (pattern regex, anyHost domain list, or extensionIn suffix
 * list). Precompiled matchers are embedded in the options so the step never
 * re-parses at runtime.
 */

import { z } from "zod";

import { assertDiagnosticName } from "../../../shared/diagnostic-names.js";
import { ConfigurationError } from "../../../shared/errors.js";

/** A compiled URL classifier. */
export interface UrlClassifyRule {
  readonly signal: string;
  readonly match: (url: string) => boolean;
}

/** Describes constructor configuration for a classify-url step instance. */
export interface ClassifyUrlStepOptions {
  readonly rules: ReadonlyArray<UrlClassifyRule>;
}

const ruleSchema = z
  .object({
    signal: z.string().min(1),
    pattern: z.string().optional(),
    anyHost: z.array(z.string().min(1)).optional(),
    extensionIn: z.array(z.string().min(1)).optional()
  })
  .strict()
  .refine(
    rule => Number(Boolean(rule.pattern)) + Number(Boolean(rule.anyHost)) + Number(Boolean(rule.extensionIn)) === 1,
    { message: "Exactly one of pattern, anyHost, or extensionIn is required per rule" }
  );

const configSchema = z
  .object({
    rules: z.array(ruleSchema).default([])
  })
  .strict();

/** Configuration shape validated by the Zod schema. */
type ParsedConfig = z.infer<typeof configSchema>;

/** Compiles one rule into a UrlClassifyRule with a precompiled match function. */
function compileRule(raw: ParsedConfig["rules"][number]): UrlClassifyRule {
  validateSignalName(raw.signal);

  if (raw.pattern !== undefined) {
    let regex: RegExp;
    try {
      regex = new RegExp(raw.pattern);
    } catch (cause) {
      throw new ConfigurationError(
        `Invalid regex in classify-url pattern: ${raw.pattern}`,
        "invalid_classify_pattern",
        { cause }
      );
    }
    return { signal: raw.signal, match: url => regex.test(url) };
  }

  if (raw.anyHost !== undefined) {
    const hosts = raw.anyHost.map(h =>
      h
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/^\./, "")
    );
    return {
      signal: raw.signal,
      match: url => {
        try {
          const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
          return hosts.some(h => host === h || host.endsWith("." + h));
        } catch {
          return false;
        }
      }
    };
  }

  if (raw.extensionIn !== undefined) {
    const extensions = raw.extensionIn.map(e => "." + e.toLowerCase().replace(/^\./, ""));
    return {
      signal: raw.signal,
      match: url => {
        try {
          const pathname = new URL(url).pathname;
          const extIndex = pathname.lastIndexOf(".");
          return extIndex >= 0 && extensions.includes(pathname.slice(extIndex).toLowerCase());
        } catch {
          return false;
        }
      }
    };
  }

  throw new ConfigurationError("Empty classify-url rule", "invalid_classify_rule");
}

/** Translates diagnostic-name failures into operator-facing classifier config errors. */
function validateSignalName(signal: string): void {
  try {
    assertDiagnosticName(signal);
  } catch (cause) {
    throw new ConfigurationError(`Invalid classify-url signal: ${signal}`, "invalid_classify_signal", { cause });
  }
}

/** Parses classify-url step configuration from YAML. */
export function parseClassifyUrlStepConfig(raw: unknown): ClassifyUrlStepOptions {
  const parsed = configSchema.parse(raw);
  const rules = parsed.rules.map(compileRule);
  return Object.freeze({ rules });
}
