export function isUnsupportedToolUseError(error: unknown) {
  return (
    error instanceof Error &&
    /no endpoints found that support tool use|does not support (tool|function)/i.test(error.message)
  );
}

export function shouldFallbackFromToolCalling({
  error,
  isGuidedRun,
  isConceptStep,
  doesRequestStructuredFinalization,
  hasProposal,
  hasConcept,
}: {
  error?: unknown;
  isGuidedRun: boolean;
  isConceptStep: boolean;
  doesRequestStructuredFinalization: boolean;
  hasProposal: boolean;
  hasConcept: boolean;
}) {
  if (error !== undefined) {
    return !hasProposal && !hasConcept && isUnsupportedToolUseError(error);
  }

  return isGuidedRun && doesRequestStructuredFinalization && (!hasProposal || (isConceptStep && !hasConcept));
}
