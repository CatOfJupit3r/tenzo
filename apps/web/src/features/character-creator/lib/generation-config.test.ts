import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_GENERATION_MODES } from './character-assistant-generation-mode';
import {
  CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA,
  DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  GENERATION_PROVIDERS,
  sanitizeCharacterGenerationConnectionSettings,
} from './generation-config';

describe('CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA', () => {
  it('defaults field template IDs for stored prompt settings that predate templates', () => {
    const result = CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA.safeParse({
      generalCharacterIdea: 'A detective',
      fieldInstructions: {},
      fieldShouldUseGeneralCharacterIdea: {},
    });

    expect(result).toEqual({
      success: true,
      data: {
        generalCharacterIdea: 'A detective',
        fieldInstructions: {},
        fieldShouldUseGeneralCharacterIdea: {},
        fieldTemplateIds: DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.fieldTemplateIds,
      },
    });
  });
});

describe('sanitizeCharacterGenerationConnectionSettings', () => {
  it('defaults stored settings that predate provider selection to KoboldCpp', () => {
    const result = sanitizeCharacterGenerationConnectionSettings({
      ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
      provider: undefined,
    });

    expect(result.provider).toBe(GENERATION_PROVIDERS.koboldcpp);
  });

  it('defaults stored settings to structured assistant generation', () => {
    const result = sanitizeCharacterGenerationConnectionSettings({
      ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
      assistantGenerationMode: undefined,
    });

    expect(result.assistantGenerationMode).toBe(CHARACTER_ASSISTANT_GENERATION_MODES['structured-output']);
  });

  it('preserves an explicit tool-call assistant mode', () => {
    const result = sanitizeCharacterGenerationConnectionSettings({
      ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
      assistantGenerationMode: CHARACTER_ASSISTANT_GENERATION_MODES['tool-call'],
    });

    expect(result.assistantGenerationMode).toBe(CHARACTER_ASSISTANT_GENERATION_MODES['tool-call']);
  });
});
