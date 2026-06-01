/**
 * Verifies that transformed body URLs remain within a captured trusted inventory.
 *
 * The step uses the same canonicalization as capture-urls. In rollback mode it
 * returns `status: "failed"` with a body effect that restores the previous body
 * version, letting the pipeline surface a degraded run while preventing
 * hallucinated URLs from reaching the final body.
 */

import { collectCanonicalUrlCounts } from "../../../shared/markdown-urls.js";

import type { PipelineContext } from "../../../contracts/pipeline/context.js";
import type { ChildReportNode, StepDiagnostics } from "../../../contracts/pipeline/diagnostics.js";
import type { PipelineStep, StepResult } from "../../../contracts/pipeline/step.js";
import type { Logger } from "../../../shared/logger.js";
import type { VerifyUrlsStepOptions } from "./verify-urls-step-config.js";

/** One hallucinated URL together with its occurrence count in the body. */
interface HallucinatedUrl {
  readonly url: string;
  readonly occurrences: number;
}

/** Validates that URLs in the current body are a subset of the captured inventory. */
export class VerifyUrlsStep implements PipelineStep {
  /** Creates a verify-urls step instance. */
  constructor(
    private readonly options: VerifyUrlsStepOptions,
    private readonly deps: { readonly logger: Logger }
  ) {}

  /** Compares URLs in the current body against the configured inventory artifact. */
  async run(ctx: PipelineContext): Promise<StepResult> {
    const body = ctx.body.current();
    if (!body) return { status: "skipped", reason: "no_body" };

    const inventory = readInventory(ctx, this.options.artifact);
    if (!inventory) return { status: "skipped", reason: "no_inventory" };

    const versions = ctx.body.versions();
    const rollbackTarget = this.options.onHallucination === "rollback" ? versions[versions.length - 2] : undefined;
    if (this.options.onHallucination === "rollback" && !rollbackTarget)
      return { status: "skipped", reason: "no_prior_version" };

    const counts = collectCanonicalUrlCounts(body.content);
    const hallucinated: HallucinatedUrl[] = [];
    for (const [url, occurrences] of counts) if (!inventory.has(url)) hallucinated.push({ url, occurrences });

    if (hallucinated.length === 0)
      return {
        status: "ok",
        diagnostics: { attributes: { artifact: this.options.artifact, url_count: counts.size } }
      };

    hallucinated.sort((left, right) => right.occurrences - left.occurrences || left.url.localeCompare(right.url));
    const reported = capReported(hallucinated, this.options.maxReportedUrls);
    const diagnostics = buildHallucinationDiagnostics(
      this.options.artifact,
      counts.size,
      hallucinated.length,
      reported
    );

    if (this.options.onHallucination === "rollback" && rollbackTarget) {
      this.deps.logger.warn(
        {
          artifact: this.options.artifact,
          hallucinated: hallucinated.length,
          reported: reported.length,
          rollback_to: rollbackTarget.stepName
        },
        "Hallucinated URLs detected; rolling body back."
      );
      return {
        status: "failed",
        reason: "hallucinated_urls",
        effects: { body: { content: rollbackTarget.content, title: rollbackTarget.title } },
        diagnostics
      };
    }

    this.deps.logger.warn(
      { artifact: this.options.artifact, hallucinated: hallucinated.length, reported: reported.length },
      "Hallucinated URLs detected; reporting without rollback."
    );
    return { status: "failed", reason: "hallucinated_urls", diagnostics };
  }
}

/** Reads the named artifact and verifies it is a Set-like URL inventory. */
function readInventory(ctx: PipelineContext, artifact: string): ReadonlySet<string> | undefined {
  const value = ctx.artifacts.get<unknown>(artifact);
  if (value instanceof Set) return value as ReadonlySet<string>;
  return undefined;
}

/** Applies the configured cap to the hallucinated URL list. */
function capReported(
  hallucinated: ReadonlyArray<HallucinatedUrl>,
  cap: number | undefined
): ReadonlyArray<HallucinatedUrl> {
  if (cap === undefined) return hallucinated;
  if (cap === 0) return [];
  return hallucinated.slice(0, cap);
}

/** Builds the diagnostics payload reported for a hallucination outcome. */
function buildHallucinationDiagnostics(
  artifact: string,
  urlCount: number,
  hallucinatedCount: number,
  reported: ReadonlyArray<HallucinatedUrl>
): StepDiagnostics {
  const children: ChildReportNode[] = reported.map(({ url, occurrences }) => ({
    name: "hallucinated_url",
    attributes: { url, occurrences }
  }));
  return {
    attributes: {
      artifact,
      url_count: urlCount,
      hallucinated_count: hallucinatedCount,
      reported_count: reported.length
    },
    children
  };
}
