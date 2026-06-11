/**
 * Serializes pipeline diagnostics into a deterministic XML footer.
 *
 * Diagnostic names are validated before rendering, and XML attribute escaping is
 * applied to every diagnostic value. Renderers pass reports through this module
 * instead of interpolating untrusted diagnostic values directly.
 */

import { assertDiagnosticName } from "../../../shared/diagnostic-names.js";

import type { ChildReportNode, DiagnosticValue } from "../../../contracts/pipeline/diagnostics.js";
import type { PipelineReport, StepReport } from "../../../contracts/pipeline/report.js";

/** Describes XML diagnostic footer rendering options. */
export interface FooterSerializerOptions {
  readonly rootElement: string;
  readonly includeSkipped: boolean;
}

/** Renders a pipeline report as an XML diagnostic footer. */
export function serializeFooter(report: PipelineReport, options: FooterSerializerOptions): string {
  assertDiagnosticName(options.rootElement);
  const rootAttrs: Record<string, DiagnosticValue | undefined> = {
    url: report.url,
    initial_length: report.initialLength,
    final_length: report.finalLength,
    ratio: report.ratio === undefined ? undefined : report.ratio.toFixed(3),
    duration_ms: report.durationMs,
    returned: report.returned,
    body_produced_by: report.bodyProducedBy,
    body_changed_by: report.bodyChangedBy,
    result: report.result,
    error: report.error
  };
  const children = report.steps
    .filter(step => options.includeSkipped || step.status !== "skipped")
    .map(step => renderStep(step, 2))
    .join("\n");
  const open = `<${options.rootElement}${renderAttrs(rootAttrs)}>`;
  const close = `</${options.rootElement}>`;
  return children ? `${open}\n${children}\n${close}` : `${open}${close}`;
}

/** Renders one step report as an XML element. */
function renderStep(step: StepReport, indent: number): string {
  const attrs: Record<string, DiagnosticValue | undefined> = {
    status: step.status,
    reason: step.reason,
    duration_ms: step.durationMs,
    input_length: step.inputLength,
    output_length: step.outputLength,
    ...step.diagnostics?.attributes
  };
  return renderNode({ name: step.name, attributes: attrs, children: step.diagnostics?.children }, indent);
}

/** Renders one diagnostic node and its descendants. */
function renderNode(
  node: {
    readonly name: string;
    readonly attributes?: Record<string, DiagnosticValue | undefined | null>;
    readonly children?: ReadonlyArray<ChildReportNode>;
  },
  indent: number
): string {
  assertDiagnosticName(node.name);
  for (const key of Object.keys(node.attributes ?? {})) assertDiagnosticName(key);
  const prefix = " ".repeat(indent);
  const attrs = renderAttrs(node.attributes ?? {});
  const children = node.children ?? [];
  if (children.length === 0) return `${prefix}<${node.name}${attrs}/>`;
  const rendered = children.map(child => renderNode(child, indent + 2)).join("\n");
  return `${prefix}<${node.name}${attrs}>\n${rendered}\n${prefix}</${node.name}>`;
}

/** Renders non-empty scalar XML attributes. */
function renderAttrs(attrs: Record<string, DiagnosticValue | undefined | null>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ` ${key}="${escapeAttr(value as DiagnosticValue)}"`)
    .join("");
}

/** Applies XML attribute escaping to untrusted diagnostic values. */
function escapeAttr(value: DiagnosticValue): string {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
