import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import Mustache from "mustache";

import type { AppConfig } from "../../config/config.js";
import type { FooterInfo } from "./debug-footer.js";
import { footerVariables } from "./debug-footer.js";

// Template renderer for stage prompts and diagnostic footer payloads.
// Mustache escaping is disabled; callers must escape values at security boundaries.
Mustache.escape = (text: string) => String(text);

export type TemplateLoader = (path: string) => Promise<string>;

export class TemplateRenderer {
  private readonly templateDir: string;
  private readonly cache = new Map<string, string>();
  private readonly loader: TemplateLoader;

  /** Create a renderer backed by filesystem templates and an in-memory cache. */
  constructor(private readonly config: AppConfig, loader?: TemplateLoader) {
    this.templateDir = resolve(config.TEMPLATE_DIR);
    this.loader = loader ?? ((path) => readFile(path, "utf8"));
  }

  /** Render a named template file with a provided view object. */
  async render(filename: string, view: Record<string, unknown>): Promise<string> {
    const template = await this.loadTemplate(filename);
    return Mustache.render(template, view);
  }

  /** Render the diagnostic footer template from FooterInfo. */
  async renderFooter(info: FooterInfo): Promise<string> {
    return this.render(this.config.FOOTER_TEMPLATE, footerVariables(info));
  }

  /** Load and cache a template file from TEMPLATE_DIR. */
  private async loadTemplate(filename: string): Promise<string> {
    const cached = this.cache.get(filename);
    if (cached !== undefined) return cached;
    const path = resolve(this.templateDir, filename);
    const content = await this.loader(path);
    this.cache.set(filename, content);
    return content;
  }
}
