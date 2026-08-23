import { describe, expect, it } from 'vitest';

import {
  getModelCompatibilityStatus,
  MODEL_CAPABILITIES,
  MODEL_COMPATIBILITY_STATUSES,
  readModelCapabilities,
} from './model-capabilities';

describe('model capabilities', () => {
  it('normalizes OpenAI-compatible supported parameters', () => {
    expect(readModelCapabilities(['temperature', 'response_format', 'tools'])).toEqual({
      [MODEL_CAPABILITIES['structured-output']]: true,
      [MODEL_CAPABILITIES['tool-calling']]: true,
      hasJointStructuredOutputAndToolCalling: true,
    });
    expect(readModelCapabilities(['structured_outputs'])).toEqual({
      [MODEL_CAPABILITIES['structured-output']]: true,
      [MODEL_CAPABILITIES['tool-calling']]: false,
      hasJointStructuredOutputAndToolCalling: false,
    });
  });

  it('requires structured output for the content-planning pipeline', () => {
    expect(
      getModelCompatibilityStatus({
        [MODEL_CAPABILITIES['structured-output']]: false,
        [MODEL_CAPABILITIES['tool-calling']]: true,
        hasJointStructuredOutputAndToolCalling: false,
      }),
    ).toBe(MODEL_COMPATIBILITY_STATUSES.incompatible);
  });

  it('reports unknown when the provider does not publish capability metadata', () => {
    expect(getModelCompatibilityStatus(null)).toBe(MODEL_COMPATIBILITY_STATUSES.unknown);
  });
});
