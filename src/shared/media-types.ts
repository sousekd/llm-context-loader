/**
 * Common media types, named for use sites.
 * The vocabulary is open: any `string` is a valid media type.
 */
export const mediaTypes = {
  html: "text/html",
  markdown: "text/markdown",
  plainText: "text/plain",
  json: "application/json",
  xml: "application/xml",
  xhtml: "application/xhtml+xml",
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  octetStream: "application/octet-stream"
} as const;

/** Returns whether a media type can be decoded and carried as UTF-8 text. */
export function isTextLike(mediaType: string): boolean {
  const normalized = mediaType.trim().toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized === mediaTypes.json ||
    normalized === mediaTypes.xml ||
    normalized === mediaTypes.xhtml ||
    normalized.endsWith("+json") ||
    normalized.endsWith("+xml")
  );
}

/** Returns whether a media type is HTML or XHTML, ignoring parameters and case. */
export function isHtmlMediaType(mediaType: string): boolean {
  const essence = mediaType.split(";", 1)[0].trim().toLowerCase();
  return essence === mediaTypes.html || essence === mediaTypes.xhtml;
}

/** Returns whether trimmed text starts with an HTML tag or XML declaration. */
export function looksLikeHtml(text: string): boolean {
  return /^\s*</.test(text);
}
