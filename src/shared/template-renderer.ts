/**
 * Renders loaded Mustache prompt templates with raw markdown values.
 *
 * Prompt templates receive page content as untrusted external content, but
 * markdown must pass through unchanged for the LLM provider. Escaping is
 * therefore disabled intentionally in this module rather than at individual
 * call sites.
 */

import Mustache from "mustache";

import { InternalError } from "./errors.js";

Mustache.escape = value => String(value);

/** Renders loaded Mustache templates with unescaped markdown variables. */
export class TemplateRenderer {
  /** Creates a renderer from eagerly loaded template text. */
  constructor(private readonly templates: ReadonlyMap<string, string>) {}

  /** Renders a named template with raw markdown variables. */
  render(name: string, variables: Record<string, unknown>): string {
    const template = this.templates.get(name);
    if (template === undefined) throw new InternalError(`Template not loaded: ${name}`, "template_not_loaded");
    return Mustache.render(template, variables);
  }
}
