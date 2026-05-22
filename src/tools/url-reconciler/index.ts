export { generateDeterministicUrlCandidates } from "./deterministic-repairs.js";
export type { DeterministicRepairOptions } from "./deterministic-repairs.js";
export { extractMarkdownUrls } from "./extract.js";
export { buildTrustedUrlInventory } from "./inventory.js";
export { matchByAnchorText } from "./match-anchor-text.js";
export type { AnchorTextMatchOptions } from "./match-anchor-text.js";
export { matchByDeterministicRepair } from "./match-deterministic.js";
export type { DeterministicMatchOptions } from "./match-deterministic.js";
export { matchByHostTypo } from "./match-host-typo.js";
export type { HostTypoMatchOptions } from "./match-host-typo.js";
export { normalizeUrlForComparison } from "./normalize.js";
export type {
  ExtractedMarkdownUrl,
  ExtractedMarkdownUrlKind,
  ExtractUrlsOptions,
  NormalizedUrl,
  NormalizeUrlsOptions,
  TrustedUrlInventory,
  TrustedUrlRecord,
  UrlParseFailure
} from "./types.js";

