/**
 * Canonical body factories for tests.
 *
 * Used for both construction and assertion so build and assert agree.
 * A future body reshape edits this single factory file.
 */

import type { BinaryBody, TextBody } from "../../src/contracts/pipeline/context.js";

export function textBody(args: {
  readonly content: string;
  readonly mediaType?: string;
  readonly title?: string;
}): TextBody {
  return { kind: "text", content: args.content, mediaType: args.mediaType ?? "text/markdown", title: args.title };
}

export function binaryBody(args: {
  readonly bytes: Uint8Array;
  readonly mediaType?: string;
  readonly title?: string;
}): BinaryBody {
  return {
    kind: "binary",
    bytes: args.bytes,
    mediaType: args.mediaType ?? "application/octet-stream",
    title: args.title
  };
}
