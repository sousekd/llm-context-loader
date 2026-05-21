import { TemplateRenderer } from "../../src/core/cleanup/templates.js";
import type { AppConfig } from "../../src/config/config.js";

// Canonical footer template used by cleanup / load-context tests so that
// renaming a footer field is a single-file change.
export const FOOTER_TEMPLATE =
  `<context_loader_info` +
  `{{#returned}} returned="{{returned}}"{{/returned}}` +
  `{{#source_url}} source_url="{{source_url}}"{{/source_url}}` +
  `{{#title}} title="{{title}}"{{/title}}` +
  `{{#fetch_status}} fetch_status="{{fetch_status}}"{{/fetch_status}}` +
  `{{#clean_status}} clean_status="{{clean_status}}"{{/clean_status}}` +
  `{{#clean_ratio}} clean_ratio="{{clean_ratio}}"{{/clean_ratio}}` +
  `{{#clean_reason}} clean_reason="{{clean_reason}}"{{/clean_reason}}` +
  `{{#summarize_status}} summarize_status="{{summarize_status}}"{{/summarize_status}}` +
  `{{#truncate_status}} truncate_status="{{truncate_status}}"{{/truncate_status}}` +
  `{{#error}} error="{{error}}"{{/error}}` +
  ` />`;

export interface TemplateOverrides {
  cleanSystem?: string;
  cleanUser?: string;
  summarizeSystem?: string;
  summarizeUser?: string;
  footer?: string;
}

// Build a `TemplateRenderer` whose loader returns the templates from
// in-memory strings. Defaults to short placeholders plus the canonical
// FOOTER_TEMPLATE.
export function makeTemplateRenderer(config: AppConfig, overrides: TemplateOverrides = {}): TemplateRenderer {
  const cleanSystem = overrides.cleanSystem ?? "CLEAN_SYS";
  const cleanUser = overrides.cleanUser ?? "CLEAN_USR {{content}}";
  const summarizeSystem = overrides.summarizeSystem ?? "SUM_SYS";
  const summarizeUser = overrides.summarizeUser ?? "SUM_USR {{content}}";
  const footer = overrides.footer ?? FOOTER_TEMPLATE;
  return new TemplateRenderer(config, async (path) => {
    if (path.endsWith(config.CLEAN_SYSTEM_TEMPLATE)) return cleanSystem;
    if (path.endsWith(config.CLEAN_USER_TEMPLATE)) return cleanUser;
    if (path.endsWith(config.SUMMARIZE_SYSTEM_TEMPLATE)) return summarizeSystem;
    if (path.endsWith(config.SUMMARIZE_USER_TEMPLATE)) return summarizeUser;
    if (path.endsWith(config.FOOTER_TEMPLATE)) return footer;
    return "TEMPLATE";
  });
}
