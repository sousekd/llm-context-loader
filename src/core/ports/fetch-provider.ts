import type { FetchedDocument } from "../types.js";

// Fetch port for acquiring a source document from a normalized URL.
// Implementations own transport details and return one markdown payload.
export interface FetchProvider {
  /** Human-readable provider identifier used in diagnostics. */
  readonly name: string;

  /** Fetch one URL and return the normalized fetched-document contract. */
  fetch(url: string): Promise<FetchedDocument>;
}
