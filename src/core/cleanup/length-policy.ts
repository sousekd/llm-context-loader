// Length and token-estimation policies shared by stage eligibility decisions.
// Uses compacted text length so all stages reason about consistent input size.
/** Compute character length after whitespace compaction. */
export function compactChars(text: string): number {
  return text.replace(/\s+/g, " ").trim().length;
}

/** Estimate token count from compacted characters and chars-per-token ratio. */
export function estimateTokens(chars: number, charsPerToken: number): number {
  if (charsPerToken <= 0) return chars;
  return Math.ceil(chars / charsPerToken);
}

export type StageEligibility =
  | { kind: "eligible" }
  | { kind: "skipped_disabled" }
  | { kind: "skipped_short" }
  | { kind: "skipped_too_long" };

export interface StageEligibilityInput {
  enabled: boolean;
  inputChars: number;
  minInputChars: number;
  maxInputChars: number;
  contextTokens: number;
  charsPerToken: number;
  outputRatio: number;
}

/** Decide whether a stage can run given feature and length constraints. */
export function checkEligibility(input: StageEligibilityInput): StageEligibility {
  if (!input.enabled) return { kind: "skipped_disabled" };
  if (input.inputChars < input.minInputChars) return { kind: "skipped_short" };
  if (input.maxInputChars > 0 && input.inputChars > input.maxInputChars) {
    return { kind: "skipped_too_long" };
  }

  const inputTokens = estimateTokens(input.inputChars, input.charsPerToken);
  const projectedTokens = Math.ceil(inputTokens * (1 + input.outputRatio));
  if (input.contextTokens > 0 && projectedTokens > input.contextTokens) {
    return { kind: "skipped_too_long" };
  }

  return { kind: "eligible" };
}
