import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_GENERATION_MODES } from '../assistant/character-assistant-generation-mode';
import { AGENT_QUALITY_PROFILES } from '../provider/agent-quality-profile';
import {
  DEFAULT_CONTEXT_SIZE,
  GENERATION_PROVIDERS,
  OUTPUT_FORMATS,
  REQUEST_MODES,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
  sanitizeCharacterGenerationConnectionSettings,
  sanitizeCharacterGenerationPromptSettings,
} from './generation-config';

describe('sanitizeCharacterGenerationPromptSettings', () => {
  const boundaryCases = [
    {
      name: 'preserves valid partial settings and drops malformed persisted entries',
      input: {
        generalCharacterIdea: 'A detective',
        fieldInstructions: {
          personality: 'Use a clipped voice',
          scenario: 17,
        },
        fieldShouldUseGeneralCharacterIdea: {
          personality: false,
          scenario: 'yes',
        },
        fieldTemplateIds: {
          personality: 'template-1',
          scenario: false,
        },
        shouldUseDefaultFieldTemplates: 'yes',
      },
      expected: {
        generalCharacterIdea: 'A detective',
        fieldInstructions: { personality: 'Use a clipped voice' },
        fieldShouldUseGeneralCharacterIdea: { personality: false },
        fieldTemplateIds: { personality: 'template-1' },
        shouldUseDefaultFieldTemplates: true,
      },
    },
    {
      name: 'accepts an empty partial record with current defaults',
      input: { generalCharacterIdea: 'A detective' },
      expected: {
        generalCharacterIdea: 'A detective',
        fieldInstructions: {},
        fieldShouldUseGeneralCharacterIdea: {},
        fieldTemplateIds: {},
        shouldUseDefaultFieldTemplates: true,
      },
    },
  ] as const;

  it.each(boundaryCases)('$name', ({ input, expected }) => {
    expect(sanitizeCharacterGenerationPromptSettings(input)).toEqual(expected);
  });
});

describe('sanitizeCharacterGenerationConnectionSettings', () => {
  it('clamps malformed sampling settings while preserving supported connection values', () => {
    const result = sanitizeCharacterGenerationConnectionSettings({
      provider: GENERATION_PROVIDERS.openrouter,
      endpoint: 'https://example.test/v1',
      model: 'example-model',
      outputFormat: OUTPUT_FORMATS.json,
      requestMode: REQUEST_MODES.browser,
      contextSize: 0,
      maxTokens: 4_096.8,
      temperature: 99,
      topP: -1,
      frequencyPenalty: -99,
      presencePenalty: 99,
      topK: 201.7,
      minP: -1,
    });

    expect(result).toMatchObject({
      provider: GENERATION_PROVIDERS.openrouter,
      endpoint: 'https://example.test/v1',
      model: 'example-model',
      outputFormat: OUTPUT_FORMATS.json,
      requestMode: REQUEST_MODES.browser,
      contextSize: DEFAULT_CONTEXT_SIZE,
      maxTokens: 4_096,
      temperature: TEMPERATURE_RANGE.max,
      topP: TOP_P_RANGE.min,
      frequencyPenalty: -2,
      presencePenalty: 2,
      topK: TOP_K_RANGE.max,
      minP: 0,
    });
  });

  it.each([
    {
      name: 'accepts the supported tool-call mode',
      value: CHARACTER_ASSISTANT_GENERATION_MODES['tool-call'],
      expected: CHARACTER_ASSISTANT_GENERATION_MODES['tool-call'],
    },
    {
      name: 'falls back from an unsupported mode',
      value: 'legacy-mode',
      expected: CHARACTER_ASSISTANT_GENERATION_MODES['structured-output'],
    },
  ] as const)('$name', ({ value, expected }) => {
    expect(sanitizeCharacterGenerationConnectionSettings({ assistantGenerationMode: value })).toMatchObject({
      assistantGenerationMode: expected,
    });
  });

  it('persists supported quality profiles and rejects unknown values', () => {
    expect(
      sanitizeCharacterGenerationConnectionSettings({ agentQualityProfile: AGENT_QUALITY_PROFILES.quality }),
    ).toMatchObject({ agentQualityProfile: AGENT_QUALITY_PROFILES.quality });
    expect(sanitizeCharacterGenerationConnectionSettings({ agentQualityProfile: 'unbounded' })).toMatchObject({
      agentQualityProfile: AGENT_QUALITY_PROFILES.balanced,
    });
  });
});
