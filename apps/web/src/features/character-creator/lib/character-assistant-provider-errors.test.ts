import { describe, expect, it } from 'vitest';

import { isUnsupportedToolUseError, shouldFallbackFromToolCalling } from './character-assistant-provider-errors';

describe('character assistant provider errors', () => {
  it('recognizes the OpenRouter no-tool-endpoint response', () => {
    expect(
      isUnsupportedToolUseError(new Error('No endpoints found that support tool use. Try disabling "read_character".')),
    ).toBe(true);
  });

  it('does not classify unrelated provider failures as tool capability errors', () => {
    expect(isUnsupportedToolUseError(new Error('Authentication failed.'))).toBe(false);
  });

  it('falls back when a guided model requests synthetic tool finalization', () => {
    expect(
      shouldFallbackFromToolCalling({
        isGuidedRun: true,
        isConceptStep: false,
        doesRequestStructuredFinalization: true,
        hasProposal: false,
        hasConcept: false,
      }),
    ).toBe(true);
  });

  it('does not retry after a tool call already created guided state', () => {
    expect(
      shouldFallbackFromToolCalling({
        error: new Error('Later provider failure'),
        isGuidedRun: true,
        isConceptStep: false,
        doesRequestStructuredFinalization: true,
        hasProposal: true,
        hasConcept: false,
      }),
    ).toBe(false);
  });

  it('falls back from an explicit unsupported-tools error outside guided mode', () => {
    expect(
      shouldFallbackFromToolCalling({
        error: new Error('No endpoints found that support tool use.'),
        isGuidedRun: false,
        isConceptStep: false,
        doesRequestStructuredFinalization: false,
        hasProposal: false,
        hasConcept: false,
      }),
    ).toBe(true);
  });

  it('allows guided conversation without forcing a proposal', () => {
    expect(
      shouldFallbackFromToolCalling({
        isGuidedRun: true,
        isConceptStep: false,
        doesRequestStructuredFinalization: false,
        hasProposal: false,
        hasConcept: false,
      }),
    ).toBe(false);
  });
});
