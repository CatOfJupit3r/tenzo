import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_GENERATION_MODES } from '../assistant/character-assistant-generation-mode';
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

  it('requires structured output and native tools for tool-call mode', () => {
    expect(
      getModelCompatibilityStatus(
        {
          [MODEL_CAPABILITIES['structured-output']]: true,
          [MODEL_CAPABILITIES['tool-calling']]: false,
          hasJointStructuredOutputAndToolCalling: false,
        },
        CHARACTER_ASSISTANT_GENERATION_MODES['tool-call'],
      ),
    ).toBe(MODEL_COMPATIBILITY_STATUSES.incompatible);
  });

  it('reports unknown when the provider does not publish capability metadata', () => {
    expect(getModelCompatibilityStatus(null, CHARACTER_ASSISTANT_GENERATION_MODES['structured-output'])).toBe(
      MODEL_COMPATIBILITY_STATUSES.unknown,
    );
  });
});
