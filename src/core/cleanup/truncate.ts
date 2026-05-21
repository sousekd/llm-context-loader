// Final-output truncation policy applied after stage processing.
// Cuts near a word boundary and appends a stable truncation marker.

const TRUNCATION_MARKER = "\n\n... [TRUNCATED]";

export interface TruncateResult {
  output: string;
  truncated: boolean;
  originalChars: number;
  outputChars: number;
}

/** Choose a cut point near targetChars while preferring a whitespace boundary. */
function chooseCutPoint(text: string, targetChars: number): number {
  let cut = targetChars;
  const minCut = Math.max(0, Math.floor(targetChars * 0.9));
  while (cut > minCut && !/\s/.test(text.charAt(cut))) cut -= 1;
  return cut === minCut ? targetChars : cut;
}

/** Truncate final body text to targetChars and append a truncation marker. */
export function truncate(text: string, targetChars: number): TruncateResult {
  const originalChars = text.length;
  if (targetChars <= 0 || originalChars <= targetChars) {
    return { output: text, truncated: false, originalChars, outputChars: originalChars };
  }

  const cut = chooseCutPoint(text, targetChars);
  const trimmed = text.slice(0, cut).replace(/\s+$/, "");
  const output = `${trimmed}${TRUNCATION_MARKER}`;
  return { output, truncated: true, originalChars, outputChars: output.length };
}
