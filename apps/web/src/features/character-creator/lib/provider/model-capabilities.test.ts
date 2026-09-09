import { describe, expect, it } from 'vitest';

import { getModelCompatibilityStatus, MODEL_COMPATIBILITY_STATUSES, readModelCapabilities } from './model-capabilities';

describe('model capabilities', () => {
  it('normalizes OpenAI-compatible supported parameters', () => {
    expect(readModelCapabilities(['temperature', 'response_format', 'tools'])).toEqual({
      hasStructuredOutput: true,
      hasToolCalling: true,
      hasJointStructuredOutputAndToolCalling: true,
    });
    expect(readModelCapabilities(['structured_outputs'])).toEqual({
      hasStructuredOutput: true,
      hasToolCalling: false,
      hasJointStructuredOutputAndToolCalling: false,
    });
  });

  it('requires structured output for the content-planning pipeline', () => {
    expect(
      getModelCompatibilityStatus({
        hasStructuredOutput: false,
        hasToolCalling: true,
        hasJointStructuredOutputAndToolCalling: false,
      }),
    ).toBe(MODEL_COMPATIBILITY_STATUSES.INCOMPATIBLE);
  });

  it('reports unknown when the provider does not publish capability metadata', () => {
    expect(getModelCompatibilityStatus(null)).toBe(MODEL_COMPATIBILITY_STATUSES.UNKNOWN);
  });
});
